"""Realistic demo data for tests: 6 program weeks of logs + measurements."""
import datetime, json, random

def make(today=None):
    random.seed(7)
    today = today or datetime.date.today()
    start = today - datetime.timedelta(days=42)
    while start.weekday() != 0:  # Monday
        start -= datetime.timedelta(days=1)
    logs, meas = {}, []
    bench, pull, legp, curl, calf = 95.0, 20.0, 160.0, 14.0, 120.0
    for wk in range(6):
        mon = start + datetime.timedelta(days=7 * wk)
        tue = mon + datetime.timedelta(days=1)
        blk, w = wk // 5 + 1, wk % 5 + 1
        if wk == 3:  # missed B one week → still closes later? keep full for simplicity
            pass
        a = {"day": "A", "block": blk, "week": w, "idx": wk, "ready": "ok" if wk != 4 else "low", "time": 90,
             "ex": {"legpress": [{"w": f"{legp:g}", "r": "10"}] * 3, "bench": [{"w": f"{bench:g}", "r": str(8 if wk % 2 == 0 else 11)}] * 3,
                    "calf_legpress": [{"w": f"{calf:g}", "r": "14"}] * 3, "oh_ext_partial": [{"w": "25", "r": "12"}] * 3},
             "rir": {"bench": "2"}}
        b = {"day": "B", "block": blk, "week": w, "idx": wk, "ready": "ok", "time": 90,
             "ex": {"pullup_w": [{"w": f"{pull:g}", "r": "8"}] * 3, "incline_curl": [{"w": f"{curl:g}", "r": "11"}] * 3, "cs_row": [{"w": "60", "r": "10"}] * 3},
             "s": {"joints": {"elbow": 1}} if wk == 4 else {}}
        logs[f"{mon.isoformat()}_A"] = a
        logs[f"{tue.isoformat()}_B"] = b
        bench += 2.5; pull += 2.5; legp += 10; curl += 1; calf += 5
        for dd in (0, 2, 4):
            d = mon + datetime.timedelta(days=dd)
            if d < today:
                meas.append({"date": d.isoformat(), "w": f"{89 - wk * 0.3 - dd * 0.05 + random.uniform(-0.4, 0.4):.1f}", "waist": f"{92 - wk * 0.4:.1f}" if dd == 0 else "", "arm": "40" if dd == 0 and wk % 2 == 0 else "", "calf": "", "bf": ""})
    cycle = {"idx": 6, "since": (start + datetime.timedelta(days=42)).isoformat(), "hist": []}
    return logs, meas, cycle

if __name__ == "__main__":
    l, m, c = make()
    print(len(l), len(m), c)
