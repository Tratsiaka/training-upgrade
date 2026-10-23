/**
 * Инфраструктура Neon для «Апгрейда» (Lakebase Postgres + Neon Auth + Function).
 *   neon deploy --env deploy.env    — применить (в файле: ALLOWED_ORIGINS, MEMBER_EMAILS, ALLOW_LOCALHOST)
 *   neon status                    — что сейчас развёрнуто
 */
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "Апгрейд API",
      source: "src/index.ts",
      env: {
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS!,
        MEMBER_EMAILS: process.env.MEMBER_EMAILS!,
        ALLOW_LOCALHOST: process.env.ALLOW_LOCALHOST ?? "1",
      },
    },
  },
});
