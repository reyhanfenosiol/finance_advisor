-- Adds a personal-vs-family ownership grouping to investment instruments,
-- so the dashboard can break down "aset pribadi" vs "aset keluarga".

alter table public.investments
  add column if not exists ownership text not null default 'pribadi'
  check (ownership in ('pribadi', 'keluarga'));
