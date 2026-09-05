-- Adds "tabungan" (regular savings account) as a distinct instrument type,
-- separate from "deposito" (fixed-term time deposit).

alter table public.investments drop constraint investments_instrument_type_check;

alter table public.investments add constraint investments_instrument_type_check
  check (instrument_type in (
    'saham', 'reksadana', 'obligasi', 'emas', 'crypto',
    'deposito', 'tabungan', 'p2p_lending', 'properti', 'lainnya'
  ));
