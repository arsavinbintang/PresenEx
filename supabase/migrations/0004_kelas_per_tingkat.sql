-- PresenEx - penambahan: jumlah kelas BERBEDA per tingkat (X / XI / XII)
-- Jalankan SETELAH 0001_init.sql, 0002_rpc.sql, dan 0003_branding.sql.
--
-- Sebelumnya satu kolom "kelas_per_tingkat" dipakai untuk ketiga tingkat
-- (misal 2 → X 1-2, XI 1-2, XII 1-2). Sekarang tiap tingkat punya jumlah
-- sendiri, misal X: 2 kelas, XI: 2 kelas, XII: 3 kelas.

-- =========================================================
-- 1. KOLOM BARU + MIGRASI DATA LAMA
-- =========================================================
alter table public.jurusan
  add column if not exists jumlah_kelas_10 smallint,
  add column if not exists jumlah_kelas_11 smallint,
  add column if not exists jumlah_kelas_12 smallint;

-- Salin nilai lama ke ketiga tingkat agar tidak ada data yang hilang.
update public.jurusan
set jumlah_kelas_10 = coalesce(kelas_per_tingkat, 3),
    jumlah_kelas_11 = coalesce(kelas_per_tingkat, 3),
    jumlah_kelas_12 = coalesce(kelas_per_tingkat, 3)
where jumlah_kelas_10 is null
   or jumlah_kelas_11 is null
   or jumlah_kelas_12 is null;

-- =========================================================
-- 2. BATASI 0–20 LALU HAPUS KOLOM LAMA
-- =========================================================
alter table public.jurusan
  alter column jumlah_kelas_10 set not null,
  alter column jumlah_kelas_11 set not null,
  alter column jumlah_kelas_12 set not null,
  add constraint jurusan_jumlah_kelas_10_check check (jumlah_kelas_10 between 0 and 20),
  add constraint jurusan_jumlah_kelas_11_check check (jumlah_kelas_11 between 0 and 20),
  add constraint jurusan_jumlah_kelas_12_check check (jumlah_kelas_12 between 0 and 20);

alter table public.jurusan
  drop column if exists kelas_per_tingkat;

-- =========================================================
-- 3. GENERATE KELAS MENGGUNAKAN JUMLAH PER TINGKAT
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
  v_jumlah smallint;
  v_nomor smallint;
  v_count int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  for v_jurusan in
    select id, jumlah_kelas_10, jumlah_kelas_11, jumlah_kelas_12
    from public.jurusan
    where is_active
  loop
    for v_tingkat in
      select t.tingkat from unnest(array[10, 11, 12]::smallint[]) as t(tingkat)
    loop
      v_jumlah := case v_tingkat
                    when 10 then v_jurusan.jumlah_kelas_10
                    when 11 then v_jurusan.jumlah_kelas_11
                    when 12 then v_jurusan.jumlah_kelas_12
                  end;

      -- jumlah 0 berarti tingkat itu tidak punya kelas untuk jurusan ini
      for v_nomor in 1..v_jumlah loop
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
-- 4. IZIN PIC MENGELOLA ANGGOTA EKSKULNYA
-- =========================================================
-- Sebelumnya hanya admin yang boleh menulis tabel members, dan PIC hanya
-- boleh membaca siswa yang sudah menjadi anggotanya. Akibatnya PIC tidak
-- bisa mencari lalu menambahkan anggota sendiri.
drop policy if exists members_write on public.members;
create policy members_write on public.members for all to authenticated
  using (public.is_admin() or public.is_pic_of(ekskul_id))
  with check (public.is_admin() or public.is_pic_of(ekskul_id));

-- PIC boleh membaca siswa aktif (untuk pencarian menambah anggota) dan siswa
-- yang pernah/sekali jadi anggota ekskulnya. Data siswa non-aktif tetap
-- tersembunyi kecuali memang anggota ekskul PIC tersebut.
create or replace function public.pic_can_read_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student
      and (
        s.status = 'aktif'
        or exists (
          select 1
          from public.members m
          join public.ekskul_pic ep on ep.ekskul_id = m.ekskul_id
          where m.student_id = s.id
            and ep.profile_id = auth.uid()
        )
      )
  );
$$;

-- =========================================================
-- 5. ROLLOVER: TOLAK SISWA BILA KELAS TUJUAN TIDAK ADA
-- =========================================================
-- Bila jumlah kelas di tingkat berikutnya berkurang, kelas tujuan bisa tidak
-- ada. Sebelumnya siswa tersebut kelasnya menjadi NULL (tanpa kelas). Sekarang
-- siswa dibiarkan dan tidak dihitung sebagai "naik kelas".
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
  v_tanpa_kelas int := 0;
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

      if v_k_target is null then
        -- Tidak ada kelas tujuan (jumlah kelas tingkat berikutnya berkurang).
        v_tanpa_kelas := v_tanpa_kelas + 1;
      else
        update public.students
        set kelas_id = v_k_target
        where id = v_s.id;

        v_naik := v_naik + 1;
      end if;
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
    'anggota_disalin', v_salin,
    'siswa_tanpa_kelas', v_tanpa_kelas
  );
end;
$$;
