-- ============================================================
-- gold_prices: riwayat harga emas lokal per gram (1 gram) per merek.
-- Antam & Galeri24 dicatat otomatis dari galeri24.co.id saat halaman Emas dibuka;
-- emas digital (Pegadaian Tabungan Emas, Treasury, Pluang, dll.) diinput manual.
-- Satu baris per user, merek, dan tanggal.
-- ============================================================
create table if not exists public.gold_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null check (brand in ('antam', 'galeri24', 'digital')),
  price_date date not null default current_date,
  -- Harga beli (yang kita bayar) dan harga buyback (yang kita terima saat jual), per gram.
  sell_price numeric(14, 2) not null check (sell_price > 0),
  buyback_price numeric(14, 2) check (buyback_price is null or buyback_price >= 0),
  source text not null default 'manual' check (source in ('otomatis', 'manual')),
  -- Untuk emas digital: nama platform, mis. "Pegadaian Tabungan Emas".
  platform text,
  created_at timestamptz not null default now(),
  unique (user_id, brand, price_date)
);

create index if not exists gold_prices_user_date_idx on public.gold_prices (user_id, price_date desc);

alter table public.gold_prices enable row level security;

create policy "gold_prices_select_own" on public.gold_prices
  for select using (auth.uid() = user_id);
create policy "gold_prices_insert_own" on public.gold_prices
  for insert with check (auth.uid() = user_id);
create policy "gold_prices_update_own" on public.gold_prices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gold_prices_delete_own" on public.gold_prices
  for delete using (auth.uid() = user_id);
