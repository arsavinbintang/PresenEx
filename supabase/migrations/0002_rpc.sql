-- PresenEx - RPC transaksional

-- =========================================================
-- SIMPAN EKSKUL + JADWAL + PIC (satu transaksi)
-- =========================================================
create or replace function public.save_ekskul(
  p_id uuid,
  p_nama text,
  p_hari smallint[],
  p_pic_ids uuid[],
  p_primary uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int;
  v_pic uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if btrim(coalesce(p_nama, '')) = '' then
    raise exception 'NAMA_REQUIRED';
  end if;

  v_count := coalesce(array_length(p_hari, 1), 0);
  if v_count < 1 then raise exception 'MIN_ONE_DAY'; end if;
  if v_count > 7 then raise exception 'MAX_SEVEN_DAYS'; end if;
  if (select count(distinct x) from unnest(p_hari) x) <> v_count then
    raise exception 'DUPLICATE_DAY';
  end if;
  if exists (select 1 from unnest(p_hari) x where x < 1 or x > 7) then
    raise exception 'INVALID_DAY';
  end if;

  if p_id is null then
    insert into public.ekskul (nama) values (btrim(p_nama)) returning id into v_id;
  else
    update public.ekskul set nama = btrim(p_nama) where id = p_id returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;

  delete from public.ekskul_jadwal where ekskul_id = v_id;
  insert into public.ekskul_jadwal (ekskul_id, hari)
  select v_id, x from unnest(p_hari) x;

  delete from public.ekskul_pic where ekskul_id = v_id;
  if p_pic_ids is not null then
    foreach v_pic in array p_pic_ids loop
      insert into public.ekskul_pic (ekskul_id, profile_id, is_primary)
      values (v_id, v_pic, v_pic = p_primary)
      on conflict do nothing;
    end loop;
  end if;

  return v_id;
end;
$$;

-- =========================================================
-- SIMPAN ABSENSI SATU SESI
-- =========================================================
create or replace function public.save_attendance(
  p_ekskul_id uuid,
  p_tanggal date,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_min date;
  v_window int;
  v_roster int;
  v_entries int;
  v_distinct int;
  v_total int;
  v_hadir int;
  v_izin int;
  v_sakit int;
  v_alpha int;
begin
  if not (public.is_admin() or public.is_pic_of(p_ekskul_id)) then
    raise exception 'FORBIDDEN';
  end if;

  if p_tanggal is null then raise exception 'DATE_REQUIRED'; end if;

  select timezone, edit_window_months into v_tz, v_window
  from public.app_settings where id = true;

  v_today := (now() at time zone v_tz)::date;
  v_min := (v_today - make_interval(months => v_window))::date;

  if p_tanggal > v_today then raise exception 'FUTURE_DATE'; end if;
  if not public.is_admin() and p_tanggal < v_min then
    raise exception 'EDIT_WINDOW_CLOSED';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'INVALID_ENTRIES';
  end if;

  select count(*) into v_roster
  from public.members m
  where m.ekskul_id = p_ekskul_id
    and m.joined_at <= p_tanggal
    and (m.left_at is null or m.left_at >= p_tanggal);

  if v_roster = 0 then raise exception 'EMPTY_ROSTER'; end if;

  select count(*), count(distinct (e ->> 'member_id'))
  into v_entries, v_distinct
  from jsonb_array_elements(p_entries) e;

  if v_entries <> v_roster or v_distinct <> v_roster then
    raise exception 'ROSTER_INCOMPLETE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    where not exists (
      select 1 from public.members m
      where m.id = (e ->> 'member_id')::uuid
        and m.ekskul_id = p_ekskul_id
        and m.joined_at <= p_tanggal
        and (m.left_at is null or m.left_at >= p_tanggal)
    )
  ) then
    raise exception 'INVALID_MEMBER';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_entries) e
    where (e ->> 'status') not in ('hadir', 'izin', 'sakit', 'alpha')
  ) then
    raise exception 'INVALID_STATUS';
  end if;

  insert into public.attendance (
    ekskul_id, member_id, student_id, kelas_id, tanggal,
    status, catatan, updated_by, updated_at
  )
  select
    p_ekskul_id,
    m.id,
    m.student_id,
    s.kelas_id,
    p_tanggal,
    (e ->> 'status')::public.attendance_status,
    nullif(btrim(coalesce(e ->> 'catatan', '')), ''),
    auth.uid(),
    now()
  from jsonb_array_elements(p_entries) e
  join public.members m on m.id = (e ->> 'member_id')::uuid
  join public.students s on s.id = m.student_id
  on conflict (member_id, tanggal) do update
    set status = excluded.status,
        catatan = excluded.catatan,
        kelas_id = excluded.kelas_id,
        updated_by = excluded.updated_by,
        updated_at = now();

  select
    count(*),
    count(*) filter (where status = 'hadir'),
    count(*) filter (where status = 'izin'),
    count(*) filter (where status = 'sakit'),
    count(*) filter (where status = 'alpha')
  into v_total, v_hadir, v_izin, v_sakit, v_alpha
  from public.attendance
  where ekskul_id = p_ekskul_id and tanggal = p_tanggal;

  insert into public.attendance_daily (
    ekskul_id, tanggal, total, hadir, izin, sakit, alpha, updated_at
  ) values (
    p_ekskul_id, p_tanggal, v_total, v_hadir, v_izin, v_sakit, v_alpha, now()
  )
  on conflict (ekskul_id, tanggal) do update
    set total = excluded.total,
        hadir = excluded.hadir,
        izin = excluded.izin,
        sakit = excluded.sakit,
        alpha = excluded.alpha,
        updated_at = now();

  insert into public.sheet_sync_jobs (ekskul_id, tanggal, action, status, run_after, updated_at)
  values (p_ekskul_id, p_tanggal, 'upsert', 'pending', now(), now())
  on conflict (ekskul_id, tanggal, action) do update
    set status = 'pending',
        run_after = now(),
        last_error = null,
        updated_at = now();

  return jsonb_build_object(
    'tanggal', p_tanggal,
    'total', v_total,
    'hadir', v_hadir,
    'izin', v_izin,
    'sakit', v_sakit,
    'alpha', v_alpha
  );
end;
$$;

-- =========================================================
-- GENERATE KELAS UNTUK SATU TAHUN AJARAN
-- =========================================================
create or replace function public.generate_kelas(p_tahun_ajaran uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  insert into public.kelas (tahun_ajaran_id, jurusan_id, tingkat, nomor)
  select p_tahun_ajaran, j.id, t.tingkat, n.nomor
  from public.jurusan j
  cross join (values (10::smallint), (11::smallint), (12::smallint)) t(tingkat)
  cross join lateral generate_series(1, j.kelas_per_tingkat) n(nomor)
  where j.is_active
  on conflict (tahun_ajaran_id, jurusan_id, tingkat, nomor) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =========================================================
-- ROLLOVER TAHUN AJARAN
-- =========================================================
create or replace function public.rollover_tahun_ajaran(
  p_nama text,
  p_mulai date,
  p_selesai date,
  p_salin_anggota boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.tahun_ajaran%rowtype;
  v_new uuid;
  v_naik int := 0;
  v_lulus int := 0;
  v_anggota int := 0;
  v_salin int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_selesai <= p_mulai then raise exception 'INVALID_RANGE'; end if;
  if btrim(coalesce(p_nama, '')) = '' then raise exception 'NAMA_REQUIRED'; end if;

  select * into v_old from public.tahun_ajaran where is_active limit 1;
  if v_old.id is null then raise exception 'NO_ACTIVE_TA'; end if;

  insert into public.tahun_ajaran (nama, mulai, selesai, is_active)
  values (btrim(p_nama), p_mulai, p_selesai, false)
  returning id into v_new;

  update public.tahun_ajaran set is_active = false where id = v_old.id;
  update public.tahun_ajaran set is_active = true where id = v_new;

  insert into public.kelas (tahun_ajaran_id, jurusan_id, tingkat, nomor)
  select v_new, j.id, t.tingkat, n.nomor
  from public.jurusan j
  cross join (values (10::smallint), (11::smallint), (12::smallint)) t(tingkat)
  cross join lateral generate_series(1, j.kelas_per_tingkat) n(nomor)
  where j.is_active
  on conflict (tahun_ajaran_id, jurusan_id, tingkat, nomor) do nothing;

  update public.students s
  set kelas_id = nk.id
  from public.kelas ok, public.kelas nk
  where s.kelas_id = ok.id
    and ok.tahun_ajaran_id = v_old.id
    and ok.tingkat in (10, 11)
    and nk.tahun_ajaran_id = v_new
    and nk.jurusan_id = ok.jurusan_id
    and nk.tingkat = ok.tingkat + 1
    and nk.nomor = ok.nomor
    and s.status = 'aktif';
  get diagnostics v_naik = row_count;

  update public.students s
  set status = 'lulus',
      lulus_at = v_old.selesai,
      kelas_id = null,
      nis = null
  from public.kelas ok
  where s.kelas_id = ok.id
    and ok.tahun_ajaran_id = v_old.id
    and ok.tingkat = 12
    and s.status = 'aktif';
  get diagnostics v_lulus = row_count;

  update public.members m
  set left_at = v_old.selesai
  where m.left_at is null;
  get diagnostics v_anggota = row_count;

  if p_salin_anggota then
    insert into public.members (ekskul_id, student_id, joined_at)
    select m.ekskul_id, m.student_id, p_mulai
    from public.members m
    join public.students s on s.id = m.student_id
    where m.left_at = v_old.selesai
      and s.status = 'aktif'
      and not exists (
        select 1 from public.members x
        where x.ekskul_id = m.ekskul_id
          and x.student_id = m.student_id
          and x.left_at is null
      );
    get diagnostics v_salin = row_count;
  end if;

  return jsonb_build_object(
    'tahun_ajaran_baru', v_new,
    'naik_kelas', v_naik,
    'lulus', v_lulus,
    'anggota_dinonaktifkan', v_anggota,
    'anggota_disalin', v_salin
  );
end;
$$;

-- =========================================================
-- PURGE SISWA LULUS
-- =========================================================
create or replace function public.purge_lulus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_months int;
  v_purge_sheets boolean;
  v_cutoff date;
  v_count int := 0;
  v_jobs int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'FORBIDDEN';
  end if;

  select purge_after_months, purge_sheets into v_months, v_purge_sheets
  from public.app_settings where id = true;

  v_cutoff := (now() at time zone 'Asia/Jakarta')::date
    - make_interval(months => v_months);

  create temporary table _purge_ids on commit drop as
  select id from public.students
  where status = 'lulus'
    and lulus_at is not null
    and lulus_at <= v_cutoff
    and purge_hold = false;

  select count(*) into v_count from _purge_ids;

  if v_count = 0 then
    return jsonb_build_object('purged', 0, 'cutoff', v_cutoff, 'jobs', 0);
  end if;

  if v_purge_sheets then
    insert into public.sheet_sync_jobs (ekskul_id, tanggal, action, status, run_after, updated_at)
    select distinct a.ekskul_id, a.tanggal, 'delete', 'pending', now(), now()
    from public.attendance a
    join _purge_ids p on p.id = a.student_id
    on conflict (ekskul_id, tanggal, action) do update
      set status = 'pending', run_after = now(), updated_at = now();
    get diagnostics v_jobs = row_count;
  end if;

  delete from public.attendance_audit where student_id in (select id from _purge_ids);
  delete from public.attendance where student_id in (select id from _purge_ids);
  delete from public.members where student_id in (select id from _purge_ids);
  delete from public.students where id in (select id from _purge_ids);

  insert into public.purge_log (jumlah_siswa, dijalankan_oleh)
  values (v_count, coalesce(auth.uid()::text, 'cron'));

  return jsonb_build_object('purged', v_count, 'cutoff', v_cutoff, 'jobs', v_jobs);
end;
$$;

-- =========================================================
-- RENDER ULANG RINGKASAN HARIAN
-- =========================================================
create or replace function public.render_ulang_ringkasan(p_dari date, p_sampai date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_sampai < p_dari then raise exception 'INVALID_RANGE'; end if;

  delete from public.attendance_daily
  where tanggal between p_dari and p_sampai;

  insert into public.attendance_daily (
    ekskul_id, tanggal, total, hadir, izin, sakit, alpha, updated_at
  )
  select
    ekskul_id,
    tanggal,
    count(*),
    count(*) filter (where status = 'hadir'),
    count(*) filter (where status = 'izin'),
    count(*) filter (where status = 'sakit'),
    count(*) filter (where status = 'alpha'),
    now()
  from public.attendance
  where tanggal between p_dari and p_sampai
  group by ekskul_id, tanggal;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =========================================================
-- KLAIM JOB SINKRONISASI (khusus service role)
-- =========================================================
create or replace function public.claim_sync_jobs(p_limit int default 20)
returns setof public.sheet_sync_jobs
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    select id
    from public.sheet_sync_jobs
    where status in ('pending', 'failed')
      and run_after <= now()
      and attempts < 5
    order by run_after
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  update public.sheet_sync_jobs j
  set status = 'processing',
      locked_at = now(),
      attempts = j.attempts + 1,
      updated_at = now()
  from claimed c
  where j.id = c.id
  returning j.*;
$$;

-- =========================================================
-- GRANT
-- =========================================================
revoke all on function public.save_ekskul(uuid, text, smallint[], uuid[], uuid) from public, anon;
revoke all on function public.save_attendance(uuid, date, jsonb) from public, anon;
revoke all on function public.generate_kelas(uuid) from public, anon;
revoke all on function public.rollover_tahun_ajaran(text, date, date, boolean) from public, anon;
revoke all on function public.purge_lulus() from public, anon;
revoke all on function public.render_ulang_ringkasan(date, date) from public, anon;
revoke all on function public.claim_sync_jobs(int) from public, anon, authenticated;
revoke all on function public.laporan_kehadiran(uuid, date, date) from public, anon;
revoke all on function public.sesi_terjadwal(uuid, date, date) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_pic_of(uuid) from public, anon;
revoke all on function public.pic_can_read_student(uuid) from public, anon;

grant execute on function public.save_ekskul(uuid, text, smallint[], uuid[], uuid) to authenticated;
grant execute on function public.save_attendance(uuid, date, jsonb) to authenticated;
grant execute on function public.generate_kelas(uuid) to authenticated;
grant execute on function public.rollover_tahun_ajaran(text, date, date, boolean) to authenticated;
grant execute on function public.purge_lulus() to authenticated, service_role;
grant execute on function public.render_ulang_ringkasan(date, date) to authenticated;
grant execute on function public.claim_sync_jobs(int) to service_role;
grant execute on function public.laporan_kehadiran(uuid, date, date) to authenticated;
grant execute on function public.sesi_terjadwal(uuid, date, date) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_pic_of(uuid) to authenticated;
grant execute on function public.pic_can_read_student(uuid) to authenticated;
