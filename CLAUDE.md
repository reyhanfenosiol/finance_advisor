# Instruksi Proyek untuk Claude Code

Baca `PRD.md` di root repo ini terlebih dahulu sebagai spesifikasi lengkap sebelum mulai coding. Dokumen ini adalah instruksi kerja ringkas.

## Tujuan
Bangun aplikasi web **Personal Finance & Investment Tracker** untuk penggunaan pribadi (single-user), dengan:
1. Pencatatan cashflow harian (pemasukan/pengeluaran) real-time.
2. Dashboard analitik cashflow (summary kategori terbanyak).
3. Pencatatan cashflow investasi (multi-instrumen).
4. Dashboard investasi (summary portofolio vs inflasi Indonesia).
5. Dua AI financial advisor (chat) berbasis OpenAI `gpt-4.1-mini` — satu untuk cashflow, satu untuk investasi.

## Stack Wajib
- Next.js 14+ (App Router), TypeScript.
- Supabase (Postgres + Auth + Realtime) sebagai database.
- Tailwind CSS + shadcn/ui.
- Recharts (atau Tremor) untuk chart.
- OpenAI API, model **`gpt-4.1-mini`**, dipanggil dari server (API routes), API key di environment variable.
- Deploy target: Vercel, domain custom via Cloudflare DNS (subdomain dari `reyhanmauluddi.web.id` — usulkan nama subdomain terbaik, mis. `finance.reyhanmauluddi.web.id`).

## Urutan Kerja (kerjakan bertahap, jangan lompat)
1. Inisialisasi project Next.js + Tailwind + shadcn/ui + koneksi Supabase.
2. Buat migration SQL untuk semua tabel di PRD.md Bagian 3, lengkap dengan RLS policies (`auth.uid() = user_id`).
3. Implementasi Supabase Auth (login/register sederhana).
4. Bangun CRUD transaksi harian (form input + list + edit/delete), dengan Supabase Realtime agar update langsung terlihat.
5. Bangun Dashboard Cashflow: total masuk/keluar/saldo, tren harian, top kategori pemasukan & pengeluaran (chart).
6. Bangun CRUD investasi: instrumen, transaksi (buy/sell), valuasi manual berkala.
7. Bangun Dashboard Investasi: total nilai portofolio vs modal disetor, alokasi aset per instrumen, grafik return vs inflasi (mulai dengan data inflasi input manual; API BPS ditambahkan setelahnya sebagai enhancement, bukan blocker).
8. Implementasi AI Advisor #1 (Cashflow) di `/api/ai/cashflow-advisor`: kirim ringkasan data cashflow user sebagai context ke OpenAI, simpan histori chat ke Supabase.
9. Implementasi AI Advisor #2 (Investment) di `/api/ai/investment-advisor`: kirim ringkasan portofolio + data inflasi terbaru sebagai context.
10. Bangun UI chat untuk kedua advisor (bisa 1 komponen reusable dengan parameter `advisorType`).
11. Setup deployment ke Vercel + environment variables.
12. Beri instruksi setup DNS Cloudflare (CNAME record) untuk custom domain.

## Aturan Penting
- **Jangan** pernah expose `OPENAI_API_KEY` atau Supabase service role key ke client-side.
- Aktifkan Row Level Security di semua tabel Supabase sejak awal.
- Semua nilai uang ditampilkan dalam format Rupiah (`Rp1.234.567`).
- UI berbahasa Indonesia.
- Setiap respons AI advisor harus menyertakan disclaimer singkat bahwa ini bukan nasihat keuangan profesional resmi.
- Untuk data inflasi: implementasikan BPS Web API (`webapi.bps.go.id`) sebagai sumber utama dengan fallback form input manual — jangan buat fitur perbandingan investasi vs inflasi bergantung penuh pada API eksternal yang mungkin tidak stabil.
- Gunakan model OpenAI persis `gpt-4.1-mini` di setiap pemanggilan API — jangan ganti model tanpa diminta.

## Referensi Lengkap
Lihat `PRD.md` untuk skema database detail, daftar halaman/fitur lengkap, struktur folder yang disarankan, dan strategi integrasi AI & data inflasi.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
