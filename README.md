# PresenEx

Aplikasi absensi ekstrakurikuler sekolah. Ringan, ramah HP, dan siap jalan di
**Vercel Hobby + Supabase Free**. Setiap absensi disimpan di Supabase dan
dicadangkan ke Google Sheets; kalau Sheets gagal, absensi tetap tersimpan.

## Fitur

- Login **username + password** (tanpa email, tanpa registrasi mandiri).
- Peran **admin** dan **PIC**. Satu ekskul bisa punya banyak PIC, satu PIC bisa
  memegang banyak ekskul.
- Jadwal **1–7 hari pertemuan** per ekskul.
- Status kehadiran: **hadir, izin, sakit, alpha**, dengan catatan opsional.
- PIC bisa mengisi/mengoreksi **rolling 6 bulan** (bisa diubah admin); admin
  bebas mengoreksi.
- Sinkronisasi otomatis ke Google Sheets + antrean ulang bila gagal.
- Dashboard admin memantau sesi hari ini, tren 6 bulan, ekskul yang perlu
  perhatian, dan antrean sinkronisasi.
- Rollover tahun ajaran: naik kelas tanpa pindah jurusan, kelas 12 menjadi
  lulus, NIS dikosongkan.
- Retensi otomatis: data pribadi + absensi siswa lulus dihapus setelah 3 bulan
  (bisa diatur), ringkasan harian tetap disimpan.
- Laporan per ekskul + ekspor CSV, pencarian siswa, impor CSV.
- **CRUD penuh** untuk tahun ajaran (buat, ubah, aktifkan, hapus), jurusan,
  kelas, siswa, pengguna, ekskul, dan sponsor.
- **Tutorial** di `/tutorial`: isi lengkap untuk admin (semua fitur + cara
  mendapatkan Spreadsheet ID) dan panduan khusus PIC bila yang masuk PIC.
- **Tema terang/gelap** bisa diatur sendiri tiap pengguna (ikut sistem, terang,
  gelap) atau diatur bawaan oleh admin.
- **Logo sekolah & logo sponsor** diunggah sendiri lewat Pengaturan, jumlah
  sponsor tidak dibatasi, dan tampil di halaman login.
- Tema mengikuti sistem, navigasi bawah di HP dan sidebar di laptop.

## Teknologi

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, RLS, RPC)
- Google Sheets API via service account (`google-auth-library`)
- Vercel Cron untuk retry sinkronisasi + retensi harian

## Struktur penting

```
supabase/migrations/0001_init.sql   skema, RLS, trigger, fungsi baca
supabase/migrations/0002_rpc.sql    RPC tulis + rollover + retensi + grant
supabase/migrations/0003_branding.sql  tema, logo, sponsor, bucket storage
supabase/migrations/0004_kelas_per_tingkat.sql  jumlah kelas per tingkat (X/XI/XII)
src/lib/actions/                    server action (admin & absensi)
src/lib/queries/                    query baca per halaman
src/lib/sheets/sync.ts              sinkronisasi Google Sheets
src/app/api/cron/daily/route.ts     cron harian (retry + retensi)
src/app/(app)/                      semua halaman setelah login
src/app/(app)/tutorial/             tutorial admin & PIC
scripts/seed-admin.mjs              pembuat admin pertama
```

## 1. Siapkan Supabase

1. Buat project gratis di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan isi file berikut **berurutan**:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rpc.sql`
   - `supabase/migrations/0003_branding.sql` (tema, logo, sponsor, storage)
   - `supabase/migrations/0004_kelas_per_tingkat.sql` (jumlah kelas X/XI/XII boleh beda)

   > Database sudah pernah dibuat? Cukup jalankan file migrasi **terbaru yang
   > belum dijalankan** (urutan file tidak boleh diacak).
3. Ambil kredensial di **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (rahasia, server-only)
4. Di **Authentication → Providers → Email**, biarkan aktif. Email konfirmasi
   tidak dipakai karena akun dibuat admin dengan email sintetis
   `username@presenex.local`.
5. Opsional: **Authentication → Settings**, nonaktifkan signup publik agar hanya
   admin yang bisa membuat akun.

> Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode client atau
> `NEXT_PUBLIC_*`.

## 2. Konfigurasi lokal

```bash
cp .env.example .env.local
```

Isi minimal:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=password-yang-kuat
SEED_ADMIN_NAMA=Administrator
```

Jalankan:

```bash
npm install
npm run seed:admin
npm run dev
```

Buka `http://localhost:3000`, login dengan username + password admin.

## 3. Google Sheets (opsional tapi disarankan)

1. Buat project di Google Cloud Console, aktifkan **Google Sheets API**.
2. Buat **Service Account**, lalu buat **JSON key**.
3. Isi `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=presenex@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Di Vercel, tempel isi private key apa adanya (dengan `\n`). Kode akan
> mengubah `\n` menjadi baris baru.

4. Buat satu spreadsheet per tahun ajaran, lalu **Share** ke email service
   account sebagai **Editor**.
5. Di aplikasi: **Sinkronisasi → Spreadsheet per tahun ajaran**, tempel
   Spreadsheet ID, centang aktif.
6. Tab `Presensi YYYY-MM` dibuat otomatis. Setiap baris memakai kunci
   `tanggal + ekskul`; menyimpan ulang sesi akan mengganti baris sesi itu.

## 4. Setup awal aplikasi

Urutan yang disarankan:

1. **Jurusan** — tambahkan kode/nama dan jumlah kelas per tingkat (1–20).
2. **Tahun ajaran** — buat dan aktifkan (mis. `2026/2027`, Juli–Juni).
3. **Kelas** — klik **Generate kelas**.
4. **Siswa** — tambah manual atau impor CSV:
   ```csv
   nama,nis,jurusan,tingkat,nomor_kelas
   Budi Santoso,24001,RPL,10,1
   Siti Aminah,,RPL,10,2
   ```
   NIS unik untuk siswa aktif. Bila NIS kosong, kombinasi kelas + nama dipakai.
5. **Pengguna** — buat akun PIC.
6. **Ekskul** — isi nama, hari pertemuan, dan PIC (boleh lebih dari satu).
7. **Anggota** — buka detail ekskul, tambahkan siswa.
8. **Absensi** — pilih ekskul, isi status, simpan.

## 5. Deploy ke Vercel Hobby

1. Push repo ke GitHub, impor ke Vercel.
2. Tambahkan environment variables yang sama seperti `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, kredensial Google (opsional), dan
   `CRON_SECRET` (string acak panjang).
3. Deploy. `vercel.json` sudah berisi cron harian:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 16 * * *" }] }
```

Vercel Hobby hanya mengizinkan **satu cron per hari per project**, jadi semua
maintenance digabung di `/api/cron/daily` (retry Sheets + retensi).

4. Uji cron manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://domain-anda.vercel.app/api/cron/daily
```

## 6. Rollover tahun ajaran

Lakukan sekitar Juli:

1. Pastikan semua absensi tahun lalu sudah lengkap.
2. Buka **Tahun ajaran → Rollover**.
3. Isi nama tahun ajaran baru + rentang tanggal, centang salin anggota bila
   ingin anggota ekskul otomatis dibawa.
4. Setelah rollover:
   - siswa kelas 10/11 naik kelas di jurusan yang sama;
   - siswa kelas 12 menjadi `lulus`, NIS di-null-kan;
   - anggota ekskul lama ditutup, anggota baru disalin untuk siswa aktif;
   - kelas baru dibuat otomatis untuk semua jurusan aktif.

Data siswa lulus dihapus otomatis oleh cron setelah masa retensi
(`purge_after_months`, default 3 bulan). Ringkasan `attendance_daily` tetap
disimpan. Gunakan **Retensi** untuk menahan penghapusan siswa tertentu
(`purge_hold`).

## 7. Backup mingguan

Workflow `.github/workflows/backup.yml` menjalankan `pg_dump` setiap Senin
01:00 UTC dan menyimpan artifact 90 hari.

1. Ambil connection string di **Supabase → Project Settings → Database**
   (gunakan direct connection atau session pooler).
2. Tambahkan sebagai secret GitHub: `SUPABASE_DB_URL`.
3. Jalankan manual lewat tab **Actions → Backup mingguan → Run workflow** untuk
   percobaan pertama.
4. Unduh artifact `.sql.gz` secara berkala dan simpan juga di Google Drive/folder
   sekolah. Backup mandiri mingguan tetap disarankan.

## 8. Perintah

```bash
npm run dev         # development
npm run typecheck   # cek TypeScript
npm run build       # build produksi
npm run lint        # ESLint
npm run seed:admin  # buat/perbarui admin pertama
```

## 9. Catatan operasional

- **NIS** hanya unik di antara siswa aktif. Setelah lulus NIS dikosongkan agar
  bisa dipakai angkatan berikutnya.
- **Koreksi absensi** selalu lewat RPC `save_attendance`; perubahan status
  dicatat di `attendance_audit`.
- **Sesi libur** bisa ditandai dari halaman absensi; sesi libur tidak dihitung
  sebagai sesi terjadwal.
- **Sheet gagal** tidak membatalkan absensi. Job masuk antrean dan dicoba lagi
  oleh cron. Pantau di **Sinkronisasi**.
- **Dashboard** memakai `attendance_daily` (agregat) agar tetap cepat walau data
  absensi besar. Bila angka terlihat tidak cocok setelah perubahan manual,
  jalankan **Pengaturan → Hitung ulang ringkasan harian**.
- **Logo & sponsor** disimpan di bucket Storage `presenex-assets` (dibuat oleh
  migrasi 0003). Berkas lama otomatis terhapus saat logo/sponsor diganti.
- **Tema** disimpan di `app_settings.tema` sebagai bawaan, sedangkan pilihan
  tiap pengguna disimpan di `localStorage` perangkat (`presenex.tema`).
- **Tutorial** bisa dibuka lewat menu Bantuan → Tutorial. Admin melihat
  panduan seluruh fitur (termasuk cara mendapatkan Spreadsheet ID), PIC
  melihat panduan tugasnya.

## 10. Troubleshooting

- **Login gagal terus** — pastikan `seed:admin` sudah dijalankan, profil aktif,
  dan password benar. Username disimpan lowercase.
- **“Supabase belum dikonfigurasi”** — `NEXT_PUBLIC_SUPABASE_URL` dan
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` belum terbaca. Restart dev server setelah
  mengubah `.env.local`.
- **Gagal membuat akun / proses antrean** — `SUPABASE_SERVICE_ROLE_KEY` belum
  diisi di server.
- **Sheets 403** — spreadsheet belum dibagikan ke email service account, atau
  Google Sheets API belum diaktifkan.
- **Logo/sponsor gagal diunggah** — jalankan `supabase/migrations/0003_branding.sql`
  (bucket `presenex-assets` dan kebijakan penyimpanannya belum ada), lalu
  periksa ukuran gambar (maksimal 1,5 MB).
- **PIC tidak bisa koreksi** — sesi lebih tua dari `edit_window_months`. Admin
  tetap bisa mengubah.
- **Rollover gagal** — pastikan ada tahun ajaran aktif dan kelas sudah dibuat.
