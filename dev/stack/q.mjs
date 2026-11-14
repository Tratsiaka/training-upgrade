// SQL к боевой базе: DATABASE_URL=… node dev/stack/q.mjs "select …"
// Строку подключения не сохраняй в репозиторий (см. CLAUDE.md, «База»).
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) { console.error("Нужна переменная DATABASE_URL"); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query(process.argv[2]);
console.log(JSON.stringify(rows, null, 1));
