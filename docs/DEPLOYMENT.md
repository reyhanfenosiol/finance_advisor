# Alur Update & Deploy Antar-Platform

Dokumen kerja untuk Claude Code dan pemilik repo. Isinya cara memindahkan perubahan dari
lokal → GitHub → Vercel (production), plus database Supabase dan DNS Cloudflare.
**Setiap kali ada alur baru atau alur berubah, perbarui dokumen ini di commit yang sama.**

Terakhir diverifikasi: 2026-10-10.

## Ringkasan

| Langkah | Dari → Ke | Otomatis? | Cara |
|---|---|---|---|
| 1 | Lokal → GitHub | Manual | `git push` dengan akun **reyhanfenosiol** (lihat §1) |
| 2 | GitHub → Vercel | **Tidak** (push tidak memicu deploy) | Vercel CLI dari checkout bersih (lihat §2) |
| 3 | Migration SQL → Supabase | Manual | Pemilik menjalankan file di SQL Editor Supabase (lihat §3) |
| 4 | Vercel → domain | Sudah terpasang | `finance.reyhanmauluddi.web.id` via CNAME Cloudflare (lihat §4) |

## 1. Lokal → GitHub

- Repo: `https://github.com/reyhanfenosiol/finance_advisor.git`, branch `master`.
- Di komputer ini ada **dua akun** GitHub di `gh` keyring: `dataspv` (akun aktif, **tidak**
  punya akses ke repo ini → push 403) dan `reyhanfenosiol` (pemilik repo).
- Git memakai Git Credential Manager yang menyimpan kredensial `dataspv`, jadi `git push` biasa
  akan gagal. Push memakai token `reyhanfenosiol` hanya untuk perintah itu, tanpa mengganti akun
  aktif atau konfigurasi global:

  ```bash
  git -c credential.helper= \
      -c 'credential.helper=!f() { test "$1" = get || exit 0; echo username=reyhanfenosiol; echo "password=$(gh auth token --user reyhanfenosiol)"; }; f' \
      push origin master
  ```

- Pesan commit berbahasa Indonesia, mengikuti gaya `git log`.

## 2. GitHub → Vercel (production)

- Project Vercel: `reyhanfenosiols-projects/cuan-finance-advisor` (ter-link lewat
  `.vercel/project.json`; `.vercel/` di-gitignore). Vercel CLI login sebagai `reyhanfenosiol`.
- Repo GitHub **tidak** terhubung ke Vercel untuk auto-deploy; semua deployment production
  dilakukan lewat CLI.
- Vercel CLI meng-upload **isi folder kerja**, bukan isi commit. Supaya perubahan yang belum di-commit
  tidak ikut ter-deploy, deploy dari worktree bersih:

  ```bash
  D=<scratchpad>/deploy
  git worktree add --detach "$D" HEAD
  mkdir -p "$D/.vercel" && cp .vercel/project.json "$D/.vercel/"
  (cd "$D" && npx vercel deploy --prod --yes)
  git worktree remove --force "$D"
  ```

- Sebelum deploy, jalankan `npx next build` di lokal agar error ketahuan lebih awal.
- Cek hasil: `npx vercel ls cuan-finance-advisor` → status **Ready**, lalu
  `curl -I https://finance.reyhanmauluddi.web.id/login` → 200.
- Environment variables (diatur di Vercel Project Settings, nilainya ada di `.env.local` lokal,
  jangan di-commit):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — boleh di client.
  - `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` — **server-only**, jangan pernah ke client.
  - Env var baru wajib ditambahkan di Vercel (Production) **sebelum** deploy kode yang memakainya.

## 3. Migration → Supabase

- File migration ada di `supabase/migrations/NNNN_nama.sql`, berurutan.
- Supabase CLI **belum di-link** ke project (`supabase migration list` → `ProjectRefNotLinkedError`),
  jadi Claude Code tidak bisa menerapkan migration. Pemilik menjalankannya sendiri lewat
  **Supabase Dashboard → SQL Editor**.
- Urutan aman: tulis migration → minta pemilik menjalankannya → baru deploy kode yang bergantung
  padanya. Halaman sebaiknya tetap tampil walaupun tabel belum ada (lihat cara `tableReady` di
  `src/app/(app)/investasi/emas/page.tsx`).
- Status migration di database production:

  | File | Status |
  |---|---|
  | 0001–0004, 0006 | Sudah diterapkan (fitur yang memakainya berjalan di production) |
  | 0005_categories_dedupe_unique.sql | **Belum dikonfirmasi**; file + perubahan `src/lib/actions/categories.ts` belum di-commit. `upsert(onConflict: "user_id,name,type")` butuh constraint dari 0005, jadi jalankan 0005 dulu sebelum commit/deploy perubahan itu. |
  | 0007_gold_prices.sql | Sudah diterapkan oleh pemilik (2026-10-10) |

  Perbarui tabel ini setiap ada migration baru.

## 4. Domain (Cloudflare DNS → Vercel)

- Domain production: **`finance.reyhanmauluddi.web.id`** (alias ke deployment production terbaru).
- DNS `reyhanmauluddi.web.id` dikelola di Cloudflare (nameserver `ada`/`gabriel.ns.cloudflare.com`).
  `finance` saat ini resolve langsung ke `76.76.21.21` (IP Vercel), artinya record-nya **A**
  `finance` → `76.76.21.21` (atau CNAME ke `cname.vercel-dns.com` yang di-flatten) dengan proxy
  status **DNS only** (awan abu-abu) agar SSL Vercel berjalan. Cek detailnya di dashboard
  Cloudflare sebelum mengubah.
- Tidak perlu diubah saat deploy biasa; alias pindah otomatis ke deployment `--prod` terbaru.

## 5. Sumber data eksternal (dipanggil dari server, tanpa API key)

| Data | Sumber | Cache | Fallback |
|---|---|---|---|
| Harga crypto (IDR) | CoinGecko `/simple/price` | 5 menit | Harga manual / valuasi terakhir |
| Tren crypto 7 hari | CoinGecko `/coins/markets?sparkline=true` | 30 menit | Pesan "data tidak tersedia" |
| Harga Antam & Galeri24 | Scraping `galeri24.co.id/harga-emas` | 1 jam | Riwayat `gold_prices` / input manual |
| Emas dunia + kurs | Yahoo Finance chart API `GC=F`, `IDR=X` | 1 jam | Pesan "data tidak tersedia" |
| Emas digital | Tidak ada API publik (Pegadaian/Treasury/Pluang) | — | Input manual di halaman Emas |
| Inflasi | BPS Web API + input manual | — | Input manual |

Catatan: `logammulia.com` memblokir akses otomatis (403); harga Antam diambil dari halaman
Galeri24. Bila struktur HTML Galeri24 berubah, perbaiki parser di `src/lib/gold-prices.ts`.
