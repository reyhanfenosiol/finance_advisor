-- Personal Finance & Investment Tracker — initial schema + RLS
-- Single-user app, but RLS is enforced with auth.uid() = user_id per project policy.

create extension if not exists "pgcrypto";

-- ============================================================
-- categories
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text,
  color text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ============================================================
-- transactions (cashflow harian)
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- ============================================================
-- investments (instrumen)
-- ============================================================
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_type text not null check (
    instrument_type in ('saham', 'reksadana', 'obligasi', 'emas', 'crypto', 'deposito', 'p2p_lending', 'properti', 'lainnya')
  ),
  instrument_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.investments enable row level security;

create policy "investments_select_own" on public.investments
  for select using (auth.uid() = user_id);
create policy "investments_insert_own" on public.investments
  for insert with check (auth.uid() = user_id);
create policy "investments_update_own" on public.investments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "investments_delete_own" on public.investments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- investment_transactions (cashflow investasi)
-- ============================================================
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  type text not null check (type in ('buy', 'sell')),
  amount numeric(14, 2) not null check (amount > 0),
  units numeric(18, 6),
  price_per_unit numeric(14, 2),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists investment_transactions_user_idx
  on public.investment_transactions (user_id, transaction_date desc);
create index if not exists investment_transactions_investment_idx
  on public.investment_transactions (investment_id);

alter table public.investment_transactions enable row level security;

create policy "investment_transactions_select_own" on public.investment_transactions
  for select using (auth.uid() = user_id);
create policy "investment_transactions_insert_own" on public.investment_transactions
  for insert with check (auth.uid() = user_id);
create policy "investment_transactions_update_own" on public.investment_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "investment_transactions_delete_own" on public.investment_transactions
  for delete using (auth.uid() = user_id);

-- ============================================================
-- investment_valuations (nilai portofolio, input manual berkala)
-- ============================================================
create table if not exists public.investment_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  valuation_date date not null default current_date,
  current_value numeric(14, 2) not null check (current_value >= 0),
  created_at timestamptz not null default now()
);

create index if not exists investment_valuations_investment_idx
  on public.investment_valuations (investment_id, valuation_date desc);

alter table public.investment_valuations enable row level security;

create policy "investment_valuations_select_own" on public.investment_valuations
  for select using (auth.uid() = user_id);
create policy "investment_valuations_insert_own" on public.investment_valuations
  for insert with check (auth.uid() = user_id);
create policy "investment_valuations_update_own" on public.investment_valuations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "investment_valuations_delete_own" on public.investment_valuations
  for delete using (auth.uid() = user_id);

-- ============================================================
-- inflation_data (BPS API atau manual, tidak per-user)
-- ============================================================
create table if not exists public.inflation_data (
  id uuid primary key default gen_random_uuid(),
  period text not null unique, -- mis. "2026-07"
  inflation_yoy numeric(6, 3) not null,
  source text not null check (source in ('bps_api', 'manual')),
  fetched_at timestamptz not null default now()
);

alter table public.inflation_data enable row level security;

-- Data inflasi bersifat referensi global (bukan per-user), tapi tetap dibatasi
-- ke user yang sudah login (aplikasi single-user, tidak ada akses publik/anon).
create policy "inflation_data_select_authenticated" on public.inflation_data
  for select using (auth.role() = 'authenticated');
create policy "inflation_data_insert_authenticated" on public.inflation_data
  for insert with check (auth.role() = 'authenticated');
create policy "inflation_data_update_authenticated" on public.inflation_data
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "inflation_data_delete_authenticated" on public.inflation_data
  for delete using (auth.role() = 'authenticated');

-- ============================================================
-- ai_conversations & ai_messages
-- ============================================================
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  advisor_type text not null check (advisor_type in ('cashflow', 'investment')),
  title text,
  created_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations_select_own" on public.ai_conversations
  for select using (auth.uid() = user_id);
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert with check (auth.uid() = user_id);
create policy "ai_conversations_update_own" on public.ai_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete using (auth.uid() = user_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;

create policy "ai_messages_select_own" on public.ai_messages
  for select using (auth.uid() = user_id);
create policy "ai_messages_insert_own" on public.ai_messages
  for insert with check (auth.uid() = user_id);
create policy "ai_messages_delete_own" on public.ai_messages
  for delete using (auth.uid() = user_id);
