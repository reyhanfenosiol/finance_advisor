// Backup data Supabase ke JSON lokal (Supabase free tier tidak punya backup otomatis).
// Memakai service role key (bypass RLS) — jalankan hanya dari mesin lokal.
//   node --env-file=.env.development.local scripts/backup-supabase.mjs
// Skema tabel ada di supabase/migrations; script ini menyimpan isi datanya.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const TABLES = [
  "categories",
  "transactions",
  "investments",
  "investment_transactions",
  "investment_valuations",
  "inflation_data",
  "ai_conversations",
  "ai_messages",
  "crypto_plans",
];
const PAGE_SIZE = 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + PAGE_SIZE - 1}` },
    });
    if (res.status === 404 || res.status === 400) {
      return { table, missing: true, error: await res.text() };
    }
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { table, rows };
}

async function dumpAuthUsers() {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!res.ok) throw new Error(`auth.users: HTTP ${res.status}`);
  const { users } = await res.json();
  return users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join("backups", stamp);
await mkdir(outDir, { recursive: true });

const summary = {};
for (const table of TABLES) {
  const result = await dumpTable(table);
  if (result.missing) {
    summary[table] = "tidak ada (belum dimigrasi)";
    continue;
  }
  await writeFile(path.join(outDir, `${table}.json`), JSON.stringify(result.rows, null, 2));
  summary[table] = result.rows.length;
}
const users = await dumpAuthUsers();
await writeFile(path.join(outDir, "auth_users.json"), JSON.stringify(users, null, 2));
summary["auth.users"] = users.length;

await writeFile(path.join(outDir, "_summary.json"), JSON.stringify({ created_at: new Date().toISOString(), summary }, null, 2));
console.log(`Backup tersimpan di ${outDir}`);
console.table(summary);
