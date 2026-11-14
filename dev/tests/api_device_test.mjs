// Device tokens against the local stack (mock Neon Auth + real function).
const FN = "http://localhost:8791", AUTH = "http://localhost:8790", O = { origin: "http://localhost:8765" };
const email = "art@example.com";
const ok = (c, m) => console.log((c ? "ok  " : "FAIL") + " " + m);
const j = async (r) => { try { return await r.json(); } catch { return null; } };
const fromB64 = (s) => JSON.parse(Buffer.from(s, "base64url").toString());
let jar = "";
const authReq = async (path, opts = {}) => {
  const r = await fetch(FN + "/auth/" + path, { method: opts.method || "GET", headers: { ...O, "content-type": "application/json", ...(jar ? { "x-auth-cookies": jar } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const sc = r.headers.get("x-auth-set-cookies");
  if (sc) jar = fromB64(sc).filter((c) => c.v).map((c) => `${c.n}=${c.v}`).join("; ");
  return r;
};
await authReq("email-otp/send-verification-otp", { method: "POST", body: { email, type: "sign-in" } });
const code = (await j(await fetch(`${AUTH}/__test/otp?email=${email}`))).code;
const si = await authReq("sign-in/email-otp", { method: "POST", body: { email, otp: code } });
ok(si.ok && jar.includes("session_token"), "signed in, cookie in jar");
const tok = await j(await authReq("token"));
ok(tok && tok.token, "got JWT");
const call = (path, auth, method = "GET", body) => fetch(FN + path, { method, headers: { ...O, "content-type": "application/json", authorization: auth }, body: body ? JSON.stringify(body) : undefined });
// device create with JWT
let r = await call("/device", "Bearer " + tok.token, "POST", { name: "iPhone · приложение" });
const dev = await j(r);
ok(r.ok && dev.token && dev.token.length >= 40 && dev.days === 180, `device created: ${r.status} id=${dev && dev.id}`);
// device cannot create another device
r = await call("/device", "Device " + dev.token, "POST", { name: "x" });
ok(r.status === 400, "device token can't mint devices: " + r.status);
// sync with device token
r = await call("/sync", "Device " + dev.token, "POST", { since: "0", changes: [{ k: "settings", v: { days: [1, 3, 5] }, u: new Date().toISOString() }] });
let d = await j(r);
ok(r.ok && d.applied === 1, "sync with device token: " + r.status + " applied=" + (d && d.applied));
// devices list
r = await call("/devices", "Device " + dev.token);
d = await j(r);
ok(r.ok && d.devices.length === 1 && d.devices[0].current && d.devices[0].name === "iPhone · приложение", "devices list: " + JSON.stringify(d));
// expire Neon session → device still works, JWT path fails
await fetch(`${AUTH}/__test/expire?email=${email}`);
r = await authReq("token");
ok(r.status === 401, "neon session expired → /token 401");
r = await call("/sync", "Device " + dev.token, "POST", { since: "0", changes: [] });
ok(r.ok, "device token still works after session expiry: " + r.status);
// stored only hash
const rows = await j(await fetch("http://localhost:8792", { method: "POST", body: "select token_hash, expires_at from app.devices" }));
ok(rows.length === 1 && rows[0].token_hash !== dev.token && rows[0].token_hash.length === 64, "only hash stored");
// garbage tokens
for (const bad of ["Device abc", "Device " + dev.token + "x", "Bearer nope", "Device " + "A".repeat(43)]) {
  r = await call("/sync", bad, "POST", { since: "0", changes: [] });
  ok(r.status === 401, `reject ${bad.slice(0, 18)}…: ${r.status}`);
}
// revoke self
r = await call("/device/revoke", "Device " + dev.token, "POST", {});
d = await j(r);
ok(r.ok && d.revoked === 1, "revoke self");
r = await call("/sync", "Device " + dev.token, "POST", { since: "0", changes: [] });
ok(r.status === 401, "revoked token rejected: " + r.status);
// other user's device id can't be revoked: create user2 device and try from user1 -> n/a; check stranger cannot create device
