-- PresenEx - RPC & transactional logic
-- Jalankan SETELAH 0001_init.sql selesai.

-- =========================================================
-- FUNGSIONALITAS LAPORAN & SESI
-- =========================================================
create or replace function public.sesi_terjadwal(
  p_ekskul uuid,
  p_dari date,
  p_sampai date
)
returns table (tanggal date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_pic_of(p_ekskul)) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select d::date
  from generate_series(p_dari, p_sampai, interval '1 day') d
  join public.ekskul_jadwal j
    on j.ekskul_id = p_ekskul
   and j.hari = extract(isodow from d)::smallint
  where not exists (
    select 1 from public.sesi_libur sl
    where sl.ekskul_id = p_ekskul and sl.tanggal = d::date
  )
  order by d;
end;
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
  sesi int,
  hadir int,
  izin int,
  sakit int,
  alpha int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_pic_of(p_ekskul)) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    s.id as student_id,
    s.nama,
    s.nis,
    coalesce(
      (
        select concat_ws(' ',
          case k.tingkat when 10 then 'X' when 11 then 'XI' when 12 then 'XII' end,
          j.kode,
          k.nomor
        )
        from public.kelas k
        join public.jurusan j on j.id = k.jurusan_id
        where k.id = s.kelas_id
      ),
      '-'
    ) as kelas,
    count(a.id)::int as sesi,
    count(a.id) filter (where a.status = 'hadir')::int as hadir,
    count(a.id) filter (where a.status = 'izin')::int as izin,
    count(a.id) filter (where a.status = 'sakit')::int as sakit,
    count(a.id) filter (where a.status = 'alpha')::int as alpha
  from public.members m
  join public.students s on s.id = m.student_id
  left join public.attendance a
    on a.member_id = m.id
   and a.tanggal between p_dari and p_sampai
  where m.ekskul_id = p_ekskul
    and m.joined_at <= p_sampai
    and (m.left_at is null or m.left_at >= p_dari)
  group by s.id, s.nama, s.nis, s.kelas_id
  order by s.nama;
end;
$$;

-- =========================================================
-- SIMPAN EKSKUL (beserta jadwal & PIC)
-- =========================================================
create or replace function public.save_ekskul(
  p_id uuid,
  p_nama text,
  p_hari smallint[],
  p_pics uuid[],
  p_primary_pic uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_h smallint;
  v_pic uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_nama is null or btrim(p_nama) = '' then raise exception 'INVALID_NAMA'; end if;
  if p_hari is null or array_length(p_hari, 1) = 0 then raise exception 'HARI_EMPTY'; end if;

  if p_id is null then
    insert into public.ekskul (nama) values (btrim(p_nama))
    returning id into v_id;
  else
    update public.ekskul
    set nama = btrim(p_nama)
    where id = p_id;
    v_id := p_id;
  end if;

  delete from public.ekskul_jadwal where ekskul_id = v_id;
  foreach v_h in array p_hari loop
    if v_h between 1 and 7 then
      insert into public.ekskul_jadwal (ekskul_id, hari)
      values (v_id, v_h)
      on conflict do nothing;
    end if;
  end loop;

  delete from public.ekskul_pic where ekskul_id = v_id;
  if p_pics is not null then
    foreach v_pic in array p_pics loop
      insert into public.ekskul_pic (ekskul_id, profile_id, is_primary)
      values (v_id, v_pic, v_pic = p_primary_pic)
      on conflict do nothing;
    end loop;
  end if;

  return v_id;
end;
$$;

-- =========================================================
-- SIMPAN ABSENSI
-- =========================================================
create or replace function public.save_attendance(
  p_ekskul uuid,
  p_tanggal date,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_member_id uuid;
  v_status public.attendance_status;
  v_catatan text;
  v_student_id uuid;
  v_kelas_id uuid;
  v_old_status public.attendance_status;
  v_old_note text;
  v_att_id uuid;
  v_edit_months int;
  v_min_date date;
  v_total int := 0;
  v_hadir int := 0;
  v_izin int := 0;
  v_sakit int := 0;
  v_alpha int := 0;
begin
  if not (public.is_admin() or public.is_pic_of(p_ekskul)) then
    raise exception 'FORBIDDEN';
  end if;

  if not public.is_admin() then
    select edit_window_months into v_edit_months from public.app_settings where id = true;
    v_min_date := (now() at time zone 'Asia/Jakarta')::date - make_interval(months => v_edit_months);
    if p_tanggal < v_min_date then
      raise exception 'OUTSIDE_EDIT_WINDOW';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_member_id := (v_item ->> 'member_id')::uuid;
    v_status := (v_item ->> 'status')::public.attendance_status;
    v_catatan := nullif(btrim(v_item ->> 'catatan'), '');

    select m.student_id, s.kelas_id into v_student_id, v_kelas_id
    from public.members m
    join public.students s on s.id = m.student_id
    where m.id = v_member_id and m.ekskul_id = p_ekskul;

    if v_student_id is null then continue; end if;

    select id, status, catatan into v_att_id, v_old_status, v_old_note
    from public.attendance
    where member_id = v_member_id and tanggal = p_tanggal;

    if v_att_id is null then
      insert into public.attendance (
        ekskul_id, member_id, student_id, kelas_id, tanggal, status, catatan, updated_by
      ) values (
        p_ekskul, v_member_id, v_student_id, v_kelas_id, p_tanggal, v_status, v_catatan, auth.uid()
      )
      returning id into v_att_id;

      insert into public.attendance_audit (
        attendance_id, member_id, student_id, ekskul_id, tanggal,
        old_status, new_status, old_note, new_note, changed_by
      ) values (
        v_att_id, v_member_id, v_student_id, p_ekskul, p_tanggal,
        null, v_status, null, v_catatan, auth.uid()
      );
    else
      if v_old_status <> v_status or coalesce(v_old_note, '') <> coalesce(v_catatan, '') then
        update public.attendance
        set status = v_status,
            catatan = v_catatan,
            updated_by = auth.uid(),
            updated_at = now()
        where id = v_att_id;

        insert into public.attendance_audit (
          attendance_id, member_id, student_id, ekskul_id, tanggal,
          old_status, new_status, old_note, new_note, changed_by
        ) values (
          v_att_id, v_member_id, v_student_id, p_ekskul, p_tanggal,
          v_old_status, v_status, v_old_note, v_catatan, auth.uid()
        );
      end if;
    end if;
  end loop;

  select count(*),
         count(*) filter (where status = 'hadir'),
         count(*) filter (where status = 'izin'),
         count(*) filter (where status = 'sakit'),
         count(*) filter (where status = 'alpha')
  into v_total, v_hadir, v_izin, v_sakit, v_alpha
  from public.attendance
  where ekskul_id = p_ekskul and tanggal = p_tanggal;

  insert into public.attendance_daily (
    ekskul_id, tanggal, total, hadir, izin, sakit, alpha, updated_at
  ) values (
    p_ekskul, p_tanggal, v_total, v_hadir, v_izin, v_sakit, v_alpha, now()
  )
  on conflict (ekskul_id, tanggal) do update
  set total = excluded.total,
      hadir = excluded.hadir,
      izin = excluded.izin,
      sakit = excluded.sakit,
      alpha = excluded.alpha,
      updated_at = now();

  insert into public.sheet_sync_jobs (ekskul_id, tanggal, action, status, run_after, updated_at)
  values (p_ekskul, p_tanggal, 'upsert', 'pending', now(), now())
  on conflict (ekskul_id, tanggal, action) do update
    set status = 'pending',
        attempts = 0,
        last_error = null,
        run_after = now(),
        updated_at = now();

  delete from public.sesi_libur where ekskul_id = p_ekskul and tanggal = p_tanggal;

  return jsonb_build_object(
    'total', v_total,
    'hadir', v_hadir,
    'izin', v_izin,
    'sakit', v_sakit,
    'alpha', v_alpha
  );
end;
$$;

-- =========================================================
-- GENERATE KELAS UNTUK TAHUN AJARAN
-- =========================================================
create or replace function public.generate_kelas(p_tahun_ajaran uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jurusan record;
  v_tingkat smallint;
  v_nomor smallint;
  v_count int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  for v_jurusan in select id, kelas_per_tingkat from public.jurusan where is_active loop
    foreach v_tingkat in array array[10, 11, 12] loop
      for v_nomor in 1..v_jurusan.kelas_per_tingkat loop
        insert into public.kelas (tahun_ajaran_id, jurusan_id, tingkat, nomor)
        values (p_tahun_ajaran, v_jurusan.id, v_tingkat, v_nomor)
        on conflict (tahun_ajaran_id, jurusan_id, tingkat, nomor) do nothing;
        if found then v_count := v_count + 1; end if;
      end loop;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- =========================================================
-- ROLLOVER TAHUN AJARAN (biasanya Juli)
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
  v_old record;
  v_new_id uuid;
  v_s record;
  v_k_target uuid;
  v_naik int := 0;
  v_lulus int := 0;
  v_salin int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_old from public.tahun_ajaran where is_active = true limit 1;
  if v_old.id is null then raise exception 'NO_ACTIVE_TA'; end if;

  update public.tahun_ajaran set is_active = false where id = v_old.id;

  insert into public.tahun_ajaran (nama, mulai, selesai, is_active)
  values (btrim(p_nama), p_mulai, p_selesai, true)
  returning id into v_new_id;

  perform public.generate_kelas(v_new_id);

  for v_s in
    select s.id, s.nama, k.jurusan_id, k.tingkat, k.nomor
    from public.students s
    join public.kelas k on k.id = s.kelas_id
    where s.status = 'aktif'
  loop
    if v_s.tingkat in (10, 11) then
      select id into v_k_target
      from public.kelas
      where tahun_ajaran_id = v_new_id
        and jurusan_id = v_s.jurusan_id
        and tingkat = v_s.tingkat + 1
        and nomor = v_s.nomor;

      update public.students
      set kelas_id = v_k_target
      where id = v_s.id;

      v_naik := v_naik + 1;
    elsif v_s.tingkat = 12 then
      update public.students
      set status = 'lulus',
          kelas_id = null,
          nis = null,
          lulus_at = v_old.selesai
      where id = v_s.id;

      v_lulus := v_lulus + 1;
    end if;
  end loop;

  update public.members set left_at = v_old.selesai where left_at is null;

  if p_salin_anggota then
    insert into public.members (ekskul_id, student_id, joined_at)
    select distinct m.ekskul_id, m.student_id, p_mulai
    from public.members m
    join public.students s on s.id = m.student_id
    where s.status = 'aktif'
      and m.left_at = v_old.selesai;
    get diagnostics v_salin = row_count;
  end if;

  return jsonb_build_object(
    'tahun_ajaran_lama', v_old.nama,
    'tahun_ajaran_baru', p_nama,
    'siswa_naik_kelas', v_naik,
    'siswa_lulus', v_lulus,
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
    count(*)::int as total,
    count(*) filter (where status = 'hadir')::int as hadir,
    count(*) filter (where status = 'izin')::int as izin,
    count(*) filter (where status = 'sakit')::int as sakit,
    count(*) filter (where status = 'alpha')::int as alpha,
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
