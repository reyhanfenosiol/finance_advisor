-- Fix: ensureDefaultCategories() memakai pola cek-lalu-insert (TOCTOU) tanpa
-- proteksi di level database, sehingga dua request /transaksi yang tumpang
-- tindih (mis. prefetch + klik) bisa sama-sama insert 11 kategori default,
-- menghasilkan kategori dobel (Belanja, Hiburan, Kesehatan, Lainnya, Makan,
-- Tagihan, Transport, dst).
--
-- transactions.category adalah kolom text bebas (bukan FK ke categories.id),
-- jadi menghapus baris kategori duplikat aman dan tidak memengaruhi transaksi
-- yang sudah ada.

-- 1) Bersihkan duplikat yang sudah terlanjur ada: sisakan satu baris per
--    (user_id, name, type) — yang paling lama dibuat (created_at, lalu id
--    sebagai tie-break bila created_at sama persis).
delete from public.categories a
using public.categories b
where a.user_id = b.user_id
  and a.name = b.name
  and a.type = b.type
  and (a.created_at, a.id) > (b.created_at, b.id);

-- 2) Cegah duplikat baru di level database. Dibungkus pengecekan agar aman
--    dijalankan ulang (constraint ini sudah ada di production).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'categories_user_name_type_key'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_user_name_type_key unique (user_id, name, type);
  end if;
end $$;
