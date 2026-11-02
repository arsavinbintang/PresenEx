-- PresenEx - skema awal
-- Jalankan di SQL Editor Supabase, atau lewat `supabase db push`.

create extension if not exists pg_trgm;

-- =========================================================
-- 1. PENGATURAN GLOBAL
-- =========================================================
create table public.app_settings (
  id boolean primary key default true check (id),
  nama_sekolah text not null default 'PresenEx',
  timezone text not null default 'Asia/Jakarta',
  warna_aksen text not null default '#2563eb',
  edit_window_months smallint not null default 6 check (edit_window_months between 1 and 24),
  purge_after_months smallint not null default 3 check (purge_after_months between 0 and 24),
  purge_sheets boolean not null default true,
  label_hadir text not null default 'Hadir',
  label_izin text not null default 'Izin',
  label_sakit text not null default 'Sakit',
  label_alpha text not null default 'Alpha',
  backup_drive_folder_id text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- =========================================================
-- 2. PROFIL & ROLE
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_norm text generated always as (lower(btrim(username))) stored,
  nama text not null,
  role text not null check (role in ('admin', 'pic')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index profiles_username on public.profiles (username_norm);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_pic_of(p_ekskul uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ekskul_pic
    where ekskul_id = p_ekskul and profile_id = auth.uid()
  );
$$;

create or replace function public.pic_can_read_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.ekskul_pic ep on ep.ekskul_id = m.ekskul_id
    where m.student_id = p_student and ep.profile_id = auth.uid()
  );
$$;

-- Profil dibuat otomatis saat akun auth dibuat (dipanggil lewat service role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, nama, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'nama', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'pic')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 3. TAHUN AJARAN, JURUSAN, KELAS
-- =========================================================
create table public.tahun_ajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  mulai date not null,
  selesai date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (selesai > mulai)
);

create unique index tahun_ajaran_one_active
  on public.tahun_ajaran (is_active) where is_active;

create table public.jurusan (
  id uuid primary key default gen_random_uuid(),
  kode text not null,
  nama text not null,
  kelas_per_tingkat smallint not null default 3
    check (kelas_per_tingkat between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index jurusan_kode on public.jurusan (upper(kode));

create table public.kelas (
  id uuid primary key default gen_random_uuid(),
  tahun_ajaran_id uuid not null references public.tahun_ajaran (id) on delete cascade,
  jurusan_id uuid not null references public.jurusan (id),
  tingkat smallint not null check (tingkat in (10, 11, 12)),
  nomor smallint not null check (nomor between 1 and 20),
  unique (tahun_ajaran_id, jurusan_id, tingkat, nomor)
);

-- =========================================================
-- 4. SISWA
-- =========================================================
create table public.students (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nis text,
  nis_norm text generated always as (nullif(upper(btrim(nis)), '')) stored,
  nama_norm text generated always as
    (lower(regexp_replace(btrim(nama), '\s+', ' ', 'g'))) stored,
  kelas_id uuid references public.kelas (id) on delete set null,
  status text not null default 'aktif'
    check (status in ('aktif', 'lulus', 'keluar')),
  lulus_at date,
  purge_hold boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index students_nis_global
  on public.students (nis_norm)
  where nis_norm is not null and status = 'aktif';

create unique index students_nama_fallback
  on public.students (kelas_id, nama_norm)
  where nis_norm is null and status = 'aktif';

create index students_kelas_active on public.students (kelas_id) where status = 'aktif';
create index students_purge on public.students (lulus_at) where status = 'lulus';
create index students_nama_trgm on public.students using gin (nama gin_trgm_ops);
create index students_nis_idx on public.students (nis_norm);

-- =========================================================
-- 5. EKSKUL, JADWAL, PIC
-- =========================================================
create table public.ekskul (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  deskripsi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index ekskul_nama on public.ekskul (lower(nama)) where is_active;

create table public.ekskul_jadwal (
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  hari smallint not null check (hari between 1 and 7),
  primary key (ekskul_id, hari)
);

create index ekskul_jadwal_hari on public.ekskul_jadwal (hari, ekskul_id);

create table public.ekskul_pic (
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (ekskul_id, profile_id)
);

create unique index ekskul_one_primary on public.ekskul_pic (ekskul_id) where is_primary;
create index ekskul_pic_profile on public.ekskul_pic (profile_id);

-- =========================================================
-- 6. KEANGGOTAAN & ABSENSI
-- =========================================================
create type public.attendance_status as enum ('hadir', 'izin', 'sakit', 'alpha');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  joined_at date not null default current_date,
  left_at date,
  check (left_at is null or left_at >= joined_at)
);

create unique index members_active
  on public.members (ekskul_id, student_id) where left_at is null;
create index members_student on public.members (student_id);
create index members_ekskul on public.members (ekskul_id) where left_at is null;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  kelas_id uuid references public.kelas (id) on delete set null,
  tanggal date not null,
  status public.attendance_status not null,
  catatan text check (char_length(catatan) <= 200),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, tanggal)
);

create index att_ekskul_date on public.attendance (ekskul_id, tanggal desc);
create index att_student_date on public.attendance (student_id, tanggal desc);
create index att_date on public.attendance (tanggal);
create index att_kelas on public.attendance (kelas_id, tanggal) where kelas_id is not null;

create table public.attendance_daily (
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  tanggal date not null,
  total int not null default 0,
  hadir int not null default 0,
  izin int not null default 0,
  sakit int not null default 0,
  alpha int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ekskul_id, tanggal)
);

create index att_daily_date on public.attendance_daily (tanggal desc);

create table public.attendance_audit (
  id bigint generated always as identity primary key,
  attendance_id uuid,
  member_id uuid,
  student_id uuid,
  ekskul_id uuid,
  tanggal date,
  old_status public.attendance_status,
  new_status public.attendance_status,
  old_note text,
  new_note text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index att_audit_student on public.attendance_audit (student_id, changed_at desc);
create index att_audit_ekskul on public.attendance_audit (ekskul_id, changed_at desc);

create table public.sesi_libur (
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  tanggal date not null,
  alasan text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (ekskul_id, tanggal)
);

-- =========================================================
-- 7. SHEETS & OPERASIONAL
-- =========================================================
create table public.sheet_config (
  id uuid primary key default gen_random_uuid(),
  tahun_ajaran_id uuid not null references public.tahun_ajaran (id) on delete cascade,
  spreadsheet_id text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index sheet_one_active on public.sheet_config (is_active) where is_active;
create unique index sheet_one_per_ta on public.sheet_config (tahun_ajaran_id);

create table public.sheet_sync_jobs (
  id bigint generated always as identity primary key,
  ekskul_id uuid not null references public.ekskul (id) on delete cascade,
  tanggal date not null,
  action text not null default 'upsert' check (action in ('upsert', 'delete')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts smallint not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (ekskul_id, tanggal, action)
);

create index jobs_ready on public.sheet_sync_jobs (run_after)
  where status in ('pending', 'failed');

create table public.purge_log (
  id bigint generated always as identity primary key,
  jumlah_siswa int not null,
  dijalankan_oleh text not null,
  created_at timestamptz not null default now()
);

create table public.error_logs (
  id bigint generated always as identity primary key,
  source text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

create index error_logs_created on public.error_logs (created_at desc);

-- =========================================================
-- 8. RLS
-- =========================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.tahun_ajaran enable row level security;
alter table public.jurusan enable row level security;
alter table public.kelas enable row level security;
alter table public.students enable row level security;
alter table public.ekskul enable row level security;
alter table public.ekskul_jadwal enable row level security;
alter table public.ekskul_pic enable row level security;
alter table public.members enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_daily enable row level security;
alter table public.attendance_audit enable row level security;
alter table public.sesi_libur enable row level security;
alter table public.sheet_config enable row level security;
alter table public.sheet_sync_jobs enable row level security;
alter table public.purge_log enable row level security;
alter table public.error_logs enable row level security;

create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy ta_read on public.tahun_ajaran for select to authenticated using (true);
create policy ta_write on public.tahun_ajaran for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy jurusan_read on public.jurusan for select to authenticated using (true);
create policy jurusan_write on public.jurusan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy kelas_read on public.kelas for select to authenticated using (true);
create policy kelas_write on public.kelas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy students_read on public.students for select to authenticated
  using (public.is_admin() or public.pic_can_read_student(id));
create policy students_write on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ekskul_read on public.ekskul for select to authenticated using (true);
create policy ekskul_write on public.ekskul for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy jadwal_read on public.ekskul_jadwal for select to authenticated using (true);
create policy jadwal_write on public.ekskul_jadwal for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ekskul_pic_read on public.ekskul_pic for select to authenticated using (true);
create policy ekskul_pic_write on public.ekskul_pic for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy members_read on public.members for select to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id));
create policy members_write on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy attendance_read on public.attendance for select to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id));

create policy daily_read on public.attendance_daily for select to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id));

create policy audit_read on public.attendance_audit for select to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id));

create policy libur_read on public.sesi_libur for select to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id));
create policy libur_write on public.sesi_libur for all to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id))
  with check (public.is_admin() or public.is_pic_of(ekskul_id));

create policy sheet_config_read on public.sheet_config for select to authenticated
  using (public.is_admin());
create policy sheet_config_write on public.sheet_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy jobs_read on public.sheet_sync_jobs for select to authenticated
  using (public.is_admin());

create policy purge_read on public.purge_log for select to authenticated
  using (public.is_admin());

create policy errors_read on public.error_logs for select to authenticated
  using (public.is_admin());

-- =========================================================
-- 9. TRIGGER AUDIT ABSENSI
-- =========================================================
create or replace function public.log_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.catatan is distinct from old.catatan then
    insert into public.attendance_audit (
      attendance_id, member_id, student_id, ekskul_id, tanggal,
      old_status, new_status, old_note, new_note, changed_by
    ) values (
      new.id, new.member_id, new.student_id, new.ekskul_id, new.tanggal,
      old.status, new.status, old.catatan, new.catatan, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_audit on public.attendance;
create trigger trg_attendance_audit
  after update on public.attendance
  for each row execute function public.log_attendance_change();

-- =========================================================
-- 10. FUNGSI BANTU
-- =========================================================
create or replace function public.sesi_terjadwal(
  p_ekskul uuid,
  p_dari date,
  p_sampai date
)
returns setof date
language sql
stable
set search_path = ''
as $$
  select d::date
  from generate_series(p_dari, p_sampai, interval '1 day') d
  where extract(isodow from d)::int in (
      select hari from public.ekskul_jadwal where ekskul_id = p_ekskul
    )
    and not exists (
      select 1 from public.sesi_libur l
      where l.ekskul_id = p_ekskul and l.tanggal = d::date
    );
$$;

create or replace function public.laporan_kehadiran(
  p_ekskul uuid,
  p_dari date,
  p_sampai date
)
returns table (
  student_id uuid,
  nama text,
  nis text,
  kelas text,
  sesi bigint,
  hadir bigint,
  izin bigint,
  sakit bigint,
  alpha bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.student_id,
    s.nama,
    s.nis,
    coalesce(string_agg(distinct
      (j.kode || ' ' || k.tingkat::text || ' ' || k.nomor::text), ', '), '-') as kelas,
    count(*)::bigint as sesi,
    count(*) filter (where a.status = 'hadir')::bigint as hadir,
    count(*) filter (where a.status = 'izin')::bigint as izin,
    count(*) filter (where a.status = 'sakit')::bigint as sakit,
    count(*) filter (where a.status = 'alpha')::bigint as alpha
  from public.attendance a
  join public.students s on s.id = a.student_id
  left join public.kelas k on k.id = a.kelas_id
  left join public.jurusan j on j.id = k.jurusan_id
  where a.ekskul_id = p_ekskul
    and a.tanggal between p_dari and p_sampai
    and (public.is_admin() or public.is_pic_of(p_ekskul))
  group by a.student_id, s.nama, s.nis
  order by s.nama;
$$;

-- =========================================================
