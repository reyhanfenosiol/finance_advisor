-- ============================================================
-- education_plans: rencana dana pendidikan anak (TK → kuliah), satu per user.
-- Data anak, asumsi biaya per jenjang, dan instrumen yang ditautkan disimpan
-- sebagai jsonb; perhitungan dilakukan di aplikasi.
-- Aman dijalankan ulang.
-- ============================================================
create table if not exists public.education_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  -- [{ "name": "Anak 1", "birth_date": "2024-05-01" }, { ... }] — maksimal 2 anak.
  children jsonb not null default '[]'::jsonb,
  -- { "tk": { "tier": "menengah", "entry_fee": 8000000, "monthly_fee": 1000000, "yearly_other": 3000000 }, "sd": {...}, ... }
  -- Untuk kuliah, monthly_fee = biaya per semester / 6.
  costs jsonb not null default '{}'::jsonb,
  education_inflation_pct numeric(5, 2) not null default 10 check (education_inflation_pct between 0 and 50),
  -- true = seluruh biaya TK–SMA dari dana investasi; false = hanya uang pangkal + tahun pertama.
  fund_full_school boolean not null default false,
  investment_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.education_plans enable row level security;

drop policy if exists "education_plans_select_own" on public.education_plans;
drop policy if exists "education_plans_insert_own" on public.education_plans;
drop policy if exists "education_plans_update_own" on public.education_plans;
drop policy if exists "education_plans_delete_own" on public.education_plans;

create policy "education_plans_select_own" on public.education_plans
  for select using (auth.uid() = user_id);
create policy "education_plans_insert_own" on public.education_plans
  for insert with check (auth.uid() = user_id);
create policy "education_plans_update_own" on public.education_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "education_plans_delete_own" on public.education_plans
  for delete using (auth.uid() = user_id);
