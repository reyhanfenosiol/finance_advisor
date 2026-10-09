// Ganti password user aplikasi lewat Supabase Admin API (untuk kasus lupa password).
// Jalankan di terminal Anda sendiri — password diketik tersembunyi, tidak tersimpan di mana pun:
//   node --env-file=.env.development.local scripts/reset-password.mjs <email>
import readline from "node:readline";

const email = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !url || !key) {
  console.error("Pemakaian: node --env-file=.env.development.local scripts/reset-password.mjs <email>");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
if (!res.ok) throw new Error(`Gagal membaca user: HTTP ${res.status}`);
const { users } = await res.json();
const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`User ${email} tidak ditemukan.`);
  process.exit(1);
}

const password = await askHidden("Password baru (min. 8 karakter): ");
const confirm = await askHidden("Ulangi password baru: ");
if (password.length < 8 || password !== confirm) {
  console.error("Password kurang dari 8 karakter atau tidak sama. Dibatalkan.");
  process.exit(1);
}

const upd = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ password }),
});
if (!upd.ok) {
  console.error(`Gagal mengganti password: HTTP ${upd.status} ${await upd.text()}`);
  process.exit(1);
}
console.log(`Password untuk ${email} berhasil diganti.`);
