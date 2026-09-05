# PRD — Personal Finance & Investment Tracker with AI Advisor

## 1. Ringkasan Proyek

Aplikasi web personal finance management untuk mencatat cashflow harian (pemasukan/pengeluaran) dan cashflow investasi secara real-time, dengan dua dashboard analitik dan dua AI advisor (chat) berbasis GPT yang menganalisis performa keuangan pengguna.

Aplikasi ini untuk **penggunaan pribadi (single-user)**, bukan multi-tenant SaaS.

---

## 2. Tech Stack

| Layer | Pilihan | Catatan |
|---|---|---|
| Frontend + Backend | **Next.js 14+ (App Router)** | Full-stack dalam satu repo, deploy ke Vercel |
| Database + Auth + Storage | **Supabase** (Postgres) | Gunakan Supabase Auth (email/password atau magic link) untuk proteksi akses karena data finansial pribadi |
| Hosting | **Vercel** | Deploy dari GitHub repo |
| Domain | **reyhanmauluddi.web.id** dengan subdomain, DNS di **Cloudflare** | Contoh subdomain: `finance.reyhanmauluddi.web.id` — Claude Code: usulkan nama depan subdomain yang sesuai (mis. `finance`, `money`, `cuan`) dan jelaskan cara setting CNAME record di Cloudflare mengarah ke Vercel |
| Styling | Tailwind CSS + shadcn/ui | Untuk dashboard yang rapi dan cepat dibangun |
| Charts | Recharts atau Tremor | Untuk visualisasi kategori & performa investasi |
| AI | **OpenAI API — model `gpt-4.1-mini`** | Dipanggil dari API route Next.js (server-side), API key disimpan di environment variable Vercel, JANGAN expose ke client |
| Data Inflasi | **BPS Web API (webapi.bps.go.id)** dengan fallback manual input | Lihat Bagian 6 |

---

## 3. Struktur Data (Supabase / Postgres)

Buat skema berikut (gunakan Row Level Security karena Supabase, walau single-user tetap aktifkan RLS dengan `auth.uid()`):

### `transactions` (cashflow harian)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | default gen_random_uuid() |
| user_id | uuid | FK ke auth.users |
| type | text | `income` atau `expense` |
| category | text | mis. Gaji, Makan, Transport, Hiburan, Tagihan, dll (buat tabel `categories` terpisah agar bisa custom) |
| amount | numeric | dalam Rupiah |
| description | text | opsional |
| transaction_date | date | tanggal transaksi (bisa beda dari created_at) |
| created_at | timestamptz | default now() |

### `categories`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid | |
| name | text | |
| type | text | `income` atau `expense` |
| icon/color | text | opsional, untuk UI |

### `investments` (instrumen)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid | |
| instrument_type | text | enum: `saham`, `reksadana`, `obligasi`, `emas`, `crypto`, `deposito`, `p2p_lending`, `properti`, `lainnya` |
| instrument_name | text | mis. "BBCA", "Reksadana Pasar Uang XYZ", "Emas Antam" |
| notes | text | opsional |

### `investment_transactions` (cashflow investasi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid | |
| investment_id | uuid | FK ke `investments` |
| type | text | `buy` (setor/beli) atau `sell` (tarik/jual) |
| amount | numeric | nilai transaksi (Rupiah) |
| units | numeric | opsional, jumlah unit/lot/lembar jika relevan |
| price_per_unit | numeric | opsional |
| transaction_date | date | |
| created_at | timestamptz | |

### `investment_valuations` (nilai portofolio saat ini, input manual berkala)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid | |
| investment_id | uuid | |
| valuation_date | date | |
| current_value | numeric | nilai wajar terkini, diinput manual oleh user secara berkala |

> Catatan: karena harga instrumen diinput manual, sediakan form ringkas untuk update nilai investasi per instrumen kapan saja. Total nilai portofolio = jumlah `current_value` terbaru per instrumen.

### `inflation_data`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| period | text | mis. "2026-07" |
| inflation_yoy | numeric | persen year-on-year |
| source | text | `bps_api` atau `manual` |
| fetched_at | timestamptz | |

### `ai_conversations` & `ai_messages`
Untuk menyimpan histori chat dengan masing-masing AI advisor (cashflow advisor & investment advisor), supaya percakapan persist antar sesi.

| Tabel | Kolom penting |
|---|---|
| `ai_conversations` | id, user_id, advisor_type (`cashflow` / `investment`), created_at |
| `ai_messages` | id, conversation_id, role (`user`/`assistant`), content, created_at |

---

## 4. Halaman & Fitur

### 4.1 Halaman Input Transaksi (Cashflow Harian)
- Form cepat input transaksi: tanggal, tipe (masuk/keluar), kategori (dropdown + tambah kategori baru), nominal, deskripsi.
- List transaksi terbaru (bisa difilter per tanggal/kategori/tipe), dengan opsi edit & hapus.
- Update realtime: gunakan Supabase Realtime subscription supaya jika ada perubahan data, dashboard ikut ter-update tanpa refresh manual.

### 4.2 Dashboard Cashflow (Page 1)
- Ringkasan: total pemasukan, total pengeluaran, saldo bersih (periode: harian/mingguan/bulanan/custom range — pakai date range picker).
- Grafik tren cashflow harian (line/bar chart).
- **Summary kategori terbanyak**: pie/bar chart top kategori pengeluaran dan top kategori pemasukan.
- Kartu ringkas "Top 5 pengeluaran terbesar bulan ini".
- **Widget AI Advisor #1 (Cashflow Advisor)**: menampilkan insight otomatis (mis. "Pengeluaran kategori Makan naik 20% dibanding bulan lalu") + tombol untuk membuka chat penuh dengan AI ini.

### 4.3 Halaman Cashflow Investasi (Page 2)
- Form input instrumen baru (jika belum ada) dan form input transaksi investasi (beli/jual/setor/tarik).
- Form update nilai wajar (valuation) per instrumen secara manual.
- List riwayat transaksi investasi per instrumen.

### 4.4 Dashboard Investasi (Page 3, atau digabung dengan 4.3)
- Ringkasan total nilai portofolio saat ini vs total modal yang disetor (menghasilkan return absolut & persentase).
- Breakdown alokasi aset per instrumen (pie chart: saham, reksadana, emas, crypto, dll).
- Grafik pertumbuhan nilai portofolio dari waktu ke waktu (berdasarkan data valuasi historis).
- **Perbandingan return investasi vs tingkat inflasi Indonesia** (garis return portofolio vs garis inflasi YoY BPS pada periode yang sama) — untuk menunjukkan apakah investasi mengalahkan inflasi (real return positif/negatif).
- **Widget AI Advisor #2 (Investment Advisor)**: insight otomatis (mis. "Return portofolio Anda 6.2% YoY, di atas inflasi 2.9%, artinya real return positif ~3.3%") + tombol chat penuh.

### 4.5 Halaman Chat AI (2 mode: Cashflow Advisor & Investment Advisor)
- Interface chat standar (bubble chat, streaming response jika memungkinkan).
- Setiap advisor punya **system prompt berbeda** dan **konteks data berbeda**:
  - **Cashflow Advisor**: dikirim ringkasan data transaksi harian user (total per kategori, tren, saldo) sebagai context sebelum menjawab.
  - **Investment Advisor**: dikirim ringkasan portofolio investasi, alokasi aset, return historis, dan data inflasi terbaru sebagai context.
- User bisa bertanya bebas (mis. "Bagaimana cara saya mengurangi pengeluaran bulan ini?" atau "Apakah alokasi investasi saya cukup diversifikasi?").
- Riwayat chat disimpan di Supabase (`ai_conversations`/`ai_messages`) agar persisten.

---

## 5. Integrasi AI (OpenAI API, model `gpt-4.1-mini`)

- Buat API route di Next.js, mis. `/api/ai/cashflow-advisor` dan `/api/ai/investment-advisor`.
- Panggil OpenAI Chat Completions API dari server (route handler), **jangan** panggil dari client langsung.
- Struktur prompt:
  1. **System prompt**: definisikan persona sebagai financial advisor Indonesia yang memahami konteks finansial personal, gaya komunikasi (ringkas, actionable, tidak menghakimi), dan batasan (bukan nasihat legal/investasi resmi, tambahkan disclaimer standar).
  2. **Context data**: ringkasan angka-angka relevan (dari query Supabase) diformat sebagai teks/JSON ringkas, disisipkan ke system atau user message.
  3. **Riwayat percakapan**: ambil dari `ai_messages` untuk conversation berjalan.
  4. **Pertanyaan user** terbaru.
- Simpan `OPENAI_API_KEY` di environment variable Vercel (bukan di client).
- Model: `gpt-4.1-mini` — pastikan Claude Code memakai nama model ini persis di parameter `model` pada request API.
- Pertimbangkan streaming response (Server-Sent Events / Vercel AI SDK) agar chat terasa responsif.

---

## 6. Data Inflasi Indonesia (BPS)

BPS tidak memiliki REST API publik yang stabil dan gratis tanpa registrasi. Gunakan strategi berikut:

1. **Sumber utama**: BPS Web API di `https://webapi.bps.go.id/v1/api/` — user perlu mendaftar API key gratis di [webapi.bps.go.id](https://webapi.bps.go.id). Claude Code perlu membuat fungsi fetch terjadwal (mis. cron job Vercel bulanan) yang mengambil data inflasi terbaru dan menyimpannya ke tabel `inflation_data`.
2. **Fallback**: jika API BPS gagal/berubah format/key belum tersedia, sediakan form input manual di halaman settings untuk memasukkan angka inflasi YoY bulanan secara manual (dengan sumber tercatat sebagai `manual`). Ini penting supaya fitur perbandingan investasi vs inflasi tidak blocked oleh ketersediaan API eksternal.
3. Dashboard investasi selalu mengambil data inflasi terbaru dari `inflation_data` (baik dari API maupun manual), diurutkan berdasarkan `period` terbaru.

---

## 7. Autentikasi & Keamanan

- Gunakan Supabase Auth (email + password cukup untuk single-user).
- Aktifkan Row Level Security di semua tabel, policy: hanya `auth.uid() = user_id` yang bisa read/write.
- Simpan semua secret (`OPENAI_API_KEY`, Supabase service role key) di Environment Variables Vercel, tidak pernah di client-side code atau di-commit ke repo.
- `.env.example` disediakan di repo, `.env.local` di-gitignore.

---

## 8. Deployment

1. Repo GitHub → connect ke Vercel project.
2. Setup environment variables di Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
3. Custom domain: tambahkan domain (Claude Code untuk mengusulkan nama subdomain, misalnya `finance.reyhanmauluddi.web.id`) di Vercel project settings → dapatkan target CNAME dari Vercel.
4. Di Cloudflare DNS, tambahkan record **CNAME** dari subdomain pilihan ke target Vercel (`cname.vercel-dns.com`), dengan proxy status **DNS only** (bukan proxied) agar SSL Vercel berjalan normal — atau ikuti instruksi terbaru dari dokumentasi Vercel saat setup, karena detail ini bisa berubah.

---

## 9. Struktur Proyek yang Diharapkan (contoh)

```
/app
  /dashboard-cashflow/page.tsx
  /dashboard-investasi/page.tsx
  /transaksi/page.tsx
  /investasi/page.tsx
  /chat/[advisorType]/page.tsx
  /api/ai/cashflow-advisor/route.ts
  /api/ai/investment-advisor/route.ts
  /api/cron/fetch-inflation/route.ts
/components
  /charts/...
  /forms/...
  /chat/...
/lib
  /supabase/client.ts
  /supabase/server.ts
  /openai/client.ts
/types
  index.ts
```

---

## 10. Prioritas Pengembangan (Saran Urutan Build)

1. Setup project Next.js + Supabase + auth dasar.
2. Skema database & RLS policies.
3. CRUD transaksi harian + list + form input.
4. Dashboard cashflow dengan chart kategori.
5. CRUD investasi (instrumen, transaksi, valuasi).
6. Dashboard investasi + perbandingan inflasi (mulai dengan input manual inflasi dulu, API BPS menyusul).
7. Integrasi AI advisor (mulai dari cashflow advisor, lalu investment advisor).
8. Chat history persistence.
9. Deploy ke Vercel + setup domain Cloudflare.
10. Polish UI/UX & responsive mobile.

---

## 11. Catatan untuk Claude Code

- Ini adalah aplikasi personal finance dengan data sensitif — selalu terapkan RLS dan jangan expose API key di client.
- Prioritaskan fungsi realtime update pada dashboard cashflow menggunakan Supabase Realtime channel.
- Gunakan format Rupiah (Rp) yang konsisten di seluruh UI (pemisah ribuan titik, tanpa desimal untuk nilai bulat).
- Bahasa UI: Bahasa Indonesia.
- Sertakan disclaimer di setiap respons AI advisor bahwa ini bukan nasihat keuangan profesional resmi.
