-- Enable Supabase Realtime broadcasts for cashflow transactions
-- (dashboard/table update live without manual refresh, per PRD 4.1)

alter publication supabase_realtime add table public.transactions;
