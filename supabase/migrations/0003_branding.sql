-- PresenEx - penambahan: tema, logo, sponsor, aset upload
-- Jalankan SETELAH 0001_init.sql dan 0002_rpc.sql.

-- =========================================================
-- 1. KOLOM BARU PENGATURAN
-- =========================================================
alter table public.app_settings
  add column if not exists tema text not null default 'auto'
    check (tema in ('auto', 'light', 'dark')),
  add column if not exists logo_path text,
  add column if not exists login_banner_path text,
  add column if not exists tanggal_libur jsonb not null default '[]'::jsonb;

-- =========================================================
-- 2. SPONSOR
-- =========================================================
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  url text,
  urutan smallint not null default 0,
  path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sponsors_order on public.sponsors (urutan, created_at);

alter table public.sponsors enable row level security;

drop policy if exists sponsors_read on public.sponsors;
drop policy if exists sponsors_write on public.sponsors;

-- Logo sekolah/sponsor bersifat publik (halaman login ditampilkan sebelum login).
create policy sponsors_read on public.sponsors for select to anon, authenticated
  using (true);
create policy sponsors_write on public.sponsors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Pengaturan tampilan (nama sekolah, warna, tema) dibaca publik agar halaman
-- login bisa menampilkan logo, warna, dan tema yang benar. Tidak berisi data rahasia.
drop policy if exists settings_public_read on public.app_settings;
create policy settings_public_read on public.app_settings for select to anon
  using (true);

-- =========================================================
-- 3. STORAGE BUCKET UNTUK LOGO & SPONSOR
-- =========================================================
insert into storage.buckets (id, name, public)
values ('presenex-assets', 'presenex-assets', true)
on conflict (id) do nothing;

drop policy if exists assets_public_read on storage.objects;
create policy assets_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'presenex-assets');

drop policy if exists assets_admin_write on storage.objects;
create policy assets_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'presenex-assets' and public.is_admin())
  with check (bucket_id = 'presenex-assets' and public.is_admin());
