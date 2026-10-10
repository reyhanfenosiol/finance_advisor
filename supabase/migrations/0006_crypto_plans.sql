-- ============================================================
-- crypto_plans: rencana investasi crypto jangka panjang (DCA), satu per user.
-- Holdings/riwayat beli tetap memakai investments + investment_transactions;
-- tabel ini hanya menyimpan pengaturan rencana.
-- ============================================================
create table if not exists public.crypto_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  monthly_dca_amount numeric(14, 2) not null default 0 check (monthly_dca_amount >= 0),
  start_date date not null default current_date,
  horizon_years int not null default 20 check (horizon_years between 1 and 50),
  max_portfolio_pct numeric(5, 2) not null default 10 check (max_portfolio_pct between 0 and 100),
  rebalance_threshold_pct numeric(5, 2) not null default 10 check (rebalance_threshold_pct between 0 and 100),
  -- Asumsi return tahunan (%) untuk simulasi; bukan prediksi.
  return_pessimistic numeric(6, 2) not null default 0,
  return_moderate numeric(6, 2) not null default 15,
  return_optimistic numeric(6, 2) not null default 30,
  -- [{ "symbol": "BTC", "coingecko_id": "bitcoin", "target_pct": 80,
  --    "investment_id": "<uuid|null>", "manual_price": <number|null> }]
  allocations jsonb not null default '[
    {"symbol": "BTC", "coingecko_id": "bitcoin", "target_pct": 80, "investment_id": null, "manual_price": null},
    {"symbol": "ETH", "coingecko_id": "ethereum", "target_pct": 20, "investment_id": null, "manual_price": null}
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.crypto_plans enable row level security;

-- Aman dijalankan ulang.
drop policy if exists "crypto_plans_select_own" on public.crypto_plans;
drop policy if exists "crypto_plans_insert_own" on public.crypto_plans;
drop policy if exists "crypto_plans_update_own" on public.crypto_plans;
drop policy if exists "crypto_plans_delete_own" on public.crypto_plans;

create policy "crypto_plans_select_own" on public.crypto_plans
  for select using (auth.uid() = user_id);
create policy "crypto_plans_insert_own" on public.crypto_plans
  for insert with check (auth.uid() = user_id);
create policy "crypto_plans_update_own" on public.crypto_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "crypto_plans_delete_own" on public.crypto_plans
  for delete using (auth.uid() = user_id);
