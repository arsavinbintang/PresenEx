import type { IconName } from "@/components/ui/icons";

export interface TutorialBlok {
  judul: string;
  langkah?: string[];
  poin?: string[];
  catatan?: string;
}

export interface TutorialBab {
  id: string;
  judul: string;
  ikon: IconName;
  ringkasan: string;
  blok: TutorialBlok[];
}

const ADMIN: TutorialBab[] = [
  {
    id: "mulai",
    judul: "Mulai & Tampilan",
    ikon: "dashboard",
    ringkasan: "Login, dashboard, dan tampilan terang/gelap.",
    blok: [
      {
        judul: "Login",
        langkah: [
          "Buka alamat aplikasi, halaman login akan tampil.",
          "Masukkan username dan password yang dibuat admin (bukan email).",
          "Tekan Masuk. Bila akun dinonaktifkan, tombol masuk akan menolak.",
        ],
      },
      {
        judul: "Dashboard",
        poin: [
          "Sesi absensi hari ini beserta jumlah yang sudah terisi.",
          "Grafik kehadiran 30 hari dan daftar ekskul yang perlu diperhatikan.",
          "Semua angka dihitung ulang otomatis setiap kali halaman dibuka.",
        ],
      },
      {
        judul: "Mode terang / mode gelap",
        langkah: [
          "Tekan ikon matahari/bulan/monitor di sidebar (atau di header atas pada HP).",
          "Urutannya: Ikut sistem → Mode terang → Mode gelap → ulang.",
          "Pilihan tersimpan di perangkat tersebut. Admin juga bisa mengatur tema bawaan semua pengguna lewat menu Pengaturan.",
        ],
      },
      {
        judul: "Menu di HP",
        poin: [
          "Menu bawah: Dashboard, Absen, Laporan, Lainnya.",
          "Halaman administrasi (Siswa, Kelas, Pengaturan, dst.) ada di menu Lainnya.",
        ],
      },
    ],
  },
  {
    id: "pengguna",
    judul: "Pengguna & PIC",
    ikon: "user",
    ringkasan: "Membuat akun admin/PIC dan menempatkannya ke ekskul.",
    blok: [
      {
        judul: "Membuat akun",
        langkah: [
          "Buka menu Pengguna → Tambah pengguna.",
          "Isi username (huruf kecil, tanpa spasi), nama lengkap, dan password.",
          "Pilih peran: admin (akses penuh) atau pic (hanya ekskul yang ditugaskan).",
          "Tekan Simpan. Username harus unik.",
        ],
      },
      {
        judul: "Menugaskan PIC ke ekskul",
        langkah: [
          "Buka menu Ekskul, pilih ekskul yang diinginkan.",
          "Di form, centang PIC yang boleh mengelola ekskul tersebut.",
          "Tandai satu PIC sebagai PIC utama.",
          "Satu PIC boleh menangani banyak ekskul, dan satu ekskul boleh punya banyak PIC.",
        ],
      },
      {
        judul: "Menonaktifkan akun",
        poin: [
          "Nonaktifkan akun agar tidak bisa login; riwayat absensi yang pernah dia ubah tetap tersimpan.",
          "Akun nonaktif tidak lagi muncul di daftar pilihan PIC.",
        ],
      },
    ],
  },
  {
    id: "periode",
    judul: "Tahun Ajaran & Data Siswa",
    ikon: "calendar",
    ringkasan: "Periode sekolah, jurusan, kelas, dan data siswa.",
    blok: [
      {
        judul: "Apa gunanya tahun ajaran?",
        poin: [
          "Tahun ajaran adalah wadah kelas, siswa, dan absensi supaya data tiap tahun tidak tercampur.",
          "Hanya satu tahun ajaran yang aktif. Data baru (siswa, kelas, absensi) selalu masuk ke tahun ajaran aktif.",
          "Alurnya: buat tahun ajaran → generate kelas → masukkan siswa → rollover saat tahun berganti → arsipkan.",
        ],
      },
      {
        judul: "Membuat & mengubah tahun ajaran",
        langkah: [
          "Buka menu Tahun ajaran → Tambah.",
          "Isi nama (misal 2026/2027), tanggal mulai, dan selesai. Tahun ajaran pertama otomatis aktif.",
          "Untuk mengubah, tekan Ubah pada baris yang diinginkan lalu simpan.",
          "Untuk menghapus, tekan ikon tempat sampah. Tahun ajaran aktif atau yang masih berisi siswa aktif tidak bisa dihapus.",
        ],
      },
      {
        judul: "Jurusan & kelas",
        langkah: [
          "Menu Jurusan → tambah jurusan (misal TKJ, TKR).",
          "Menu Kelas → pilih tahun ajaran lalu tekan Generate untuk membuat kelas 10/11/12 seluruh jurusan sekaligus.",
          "Bisa juga menambah kelas satu per satu. Jumlah rombongan per kelas diatur di Pengaturan.",
          "Kelas kosong bisa dihapus; kelas berisi siswa harus dikosongkan dulu.",
        ],
      },
      {
        judul: "Siswa",
        langkah: [
          "Menu Siswa → Tambah untuk menambah satu siswa.",
          "Isi NIS bila ada; NIS wajib unik di antara siswa aktif. NIS kosong diperbolehkan (pembeda: kelas + nama).",
          "Untuk data besar, pakai Impor CSV: unduh template, isi, lalu unggah.",
          "Tekan ikon pensil pada baris untuk mengubah atau menghapus siswa beserta riwayatnya.",
        ],
      },
      {
        judul: "Rollover (kenaikan kelas)",
        langkah: [
          "Buka menu Tahun ajaran → Rollover ke tahun ajaran baru.",
          "Isi nama dan periode tahun ajaran baru, centang salin anggota ekskul bila diperlukan.",
          "Tekan Jalankan rollover. Kelas 10 → 11, kelas 11 → 12, kelas 12 lulus dengan NIS dikosongkan.",
          "Tahun ajaran baru langsung aktif. Data pribadi siswa lulus otomatis dihapus setelah masa retensi (atur di Retensi).",
        ],
        catatan:
          "Rollover tidak bisa dibatalkan. Pastikan sudah yakin sebelum menekan tombolnya.",
      },
    ],
  },
  {
    id: "ekskul",
    judul: "Ekskul & Jadwal",
    ikon: "school",
    ringkasan: "Membuat ekskul, jadwal hari, dan anggota.",
    blok: [
      {
        judul: "Menambah ekskul",
        langkah: [
          "Buka menu Ekskul → tombol Tambah (formulir muncul di jendela).",
          "Isi nama ekskul, centang hari pertemuan (1–7 hari boleh), pilih PIC.",
          "Tekan Simpan ekskul. Anda akan diarahkan ke halaman ekskul tersebut.",
        ],
      },
      {
        judul: "Mengelola anggota",
        langkah: [
          "Buka ekskul → tab anggota → Tambah anggota.",
          "Pilih siswa dan tanggal bergabung (default hari ini).",
          "Anggota yang sudah keluar (left) tidak dihitung pada sesi baru, tetapi riwayat lamanya tetap ada.",
        ],
      },
      {
        judul: "Mengarsipkan ekskul",
        poin: [
          "Arsip membuat ekskul tidak lagi muncul di daftar aktif dan tidak ada sesi baru.",
          "Data absensi lama tidak dihapus. Ekskul bisa diaktifkan kembali kapan saja.",
        ],
      },
    ],
  },
  {
    id: "absen",
    judul: "Absensi",
    ikon: "absen",
    ringkasan: "Mengisi, mengoreksi, dan menandai sesi libur.",
    blok: [
      {
        judul: "Mengisi absensi",
        langkah: [
          "Buka menu Absensi → pilih ekskul → pilih tanggal (default hari ini).",
          "Pilih status tiap siswa: Hadir, Izin, Sakit, atau Alpha. Isi catatan bila perlu.",
          "Tekan Simpan. Ringkasan jumlah tiap status langsung tampil.",
        ],
      },
      {
        judul: "Koreksi absensi",
        poin: [
          "PIC hanya bisa mengubah absensi dalam jangka waktu yang diatur admin (default 6 bulan ke belakang).",
          "Admin bebas mengubah absensi kapan pun.",
          "Setiap perubahan tercatat di riwayat audit: siapa mengubah, status lama → baru.",
        ],
      },
      {
        judul: "Sesi libur",
        poin: [
          "Gunakan tombol Tandai libur bila ekskul tidak jadi pada tanggal tersebut.",
          "Sesi libur tidak dihitung sebagai sesi terjadwal di laporan.",
        ],
      },
      {
        judul: "Tentang Google Sheets",
        poin: [
          "Absensi tetap tersimpan walau Sheets gagal; data masuk antrean dan dicoba ulang otomatis.",
          "Jadi jangan mengulang penyimpanan hanya karena muncul peringatan sinkronisasi.",
        ],
      },
    ],
  },
  {
    id: "laporan",
    judul: "Laporan & Ekspor",
    ikon: "laporan",
    ringkasan: "Rekap kehadiran per ekskul dan unduhan CSV.",
    blok: [
      {
        judul: "Melihat laporan",
        langkah: [
          "Buka menu Laporan → pilih ekskul.",
          "Atur rentang tanggal (default bulan berjalan).",
          "Tampil rekap per siswa (hadir/izin/sakit/alpha), grafik harian, dan jumlah sesi terjadwal.",
        ],
      },
      {
        judul: "Ekspor CSV",
        langkah: [
          "Tekan tombol Ekspor CSV di halaman laporan.",
          "File unduhan berisi rekap per siswa sesuai filter yang sedang dipilih.",
        ],
      },
      {
        judul: "Riwayat perubahan",
        poin: [
          "Halaman detail siswa menampilkan riwayat absensi dan audit perubahannya.",
        ],
      },
    ],
  },
  {
    id: "sheets",
    judul: "Google Sheets & Spreadsheet ID",
    ikon: "sheet",
    ringkasan: "Cara mendapatkan Spreadsheet ID dan menyambungkannya.",
    blok: [
      {
        judul: "Apa itu Spreadsheet ID?",
        poin: [
          "Spreadsheet ID adalah kode unik sebuah file Google Sheets, contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms.",
          "ID ini yang dipakai PresenEx untuk menulis absensi ke sheet Anda.",
        ],
      },
      {
        judul: "Cara mendapatkan Spreadsheet ID",
        langkah: [
          "Buka https://sheets.new (login dengan akun Google sekolah Anda).",
          "Tunggu sampai spreadsheet kosong selesai dibuat.",
          "Lihat bilah alamat di atas browser. Formatnya: https://docs.google.com/spreadsheets/d/ ID_DISINI /edit#gid=0",
          "Salin teks yang berada di antara /d/ dan /edit — itulah Spreadsheet ID.",
          "Ber nama file dulu (misal Absensi Ekstrakurikuler 2026/2027) agar mudah dicari.",
        ],
        catatan:
          "Cara lain: di dalam spreadsheet, pilih File → Bagikan, atau lihat bagian ID file pada detail dokumen. Yang penting ID terambil dari URL bagian setelah /d/.",
      },
      {
        judul: "Mempersiapkan akses layanan (sekali saja)",
        langkah: [
          "Buka Google Cloud Console → buat project baru (atau pakai yang ada).",
          "Aktifkan Google Sheets API pada menu APIs & Services → Library.",
          "Buat Service Account: IAM & Admin → Service Accounts → Create. Unduh kunci berformat .json.",
          "Salin alamat email service account (berakhiran .gserviceaccount.com).",
          "Buka spreadsheet Anda → Bagikan → tambahkan alamat email service account → beri izin Editor.",
        ],
      },
      {
        judul: "Mengisi Spreadsheet ID di PresenEx",
        langkah: [
          "Login sebagai admin → menu Sinkronisasi.",
          "Tekan Tambah/Ubah konfigurasi, pilih tahun ajaran.",
          "Tempel Spreadsheet ID tadi ke kolom Spreadsheet ID.",
          "Centang aktif lalu simpan.",
          "Tekan Tautan untuk membuka sheet dan memastikan isinya benar.",
        ],
        catatan:
          "Satu tahun ajaran boleh memakai spreadsheet terpisah agar arsip rapi. Bila kolom tidak muncul, pastikan variabel GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY sudah diisi lalu deploy ulang.",
      },
      {
        judul: "Bila muncul error 403 / sheet tidak terisi",
        poin: [
          "Email service account belum dibagikan ke spreadsheet → bagikan sebagai Editor.",
          "Google Sheets API belum diaktifkan → aktifkan di Google Cloud Console.",
          "Spreadsheet ID salah → periksa lagi bagian URL setelah /d/.",
          "Absensi tetap aman di aplikasi; tekan Coba ulang di halaman Sinkronisasi setelah diperbaiki.",
        ],
      },
    ],
  },
  {
    id: "pengaturan",
    judul: "Pengaturan, Logo & Backup",
    ikon: "settings",
    ringkasan: "Tema, warna, logo, sponsor, retensi, dan cadangan.",
    blok: [
      {
        judul: "Tampilan aplikasi",
        langkah: [
          "Buka menu Pengaturan → bagian Tampilan.",
          "Warna aksen: pilih warna tombol/aksen utama (berlaku untuk semua pengguna).",
          "Tema bawaan: Ikut sistem / Terang / Gelap untuk semua pengguna. Pengguna tetap bisa mengganti sendiri lewat tombol tema.",
          "Logo: unggah gambar (PNG/JPG/SVG/WEBP, maksimal 1,5 MB). Logo tampil di sidebar, header, dan halaman login.",
          "Logo sponsor: tambah sebanyak yang dibutuhkan, isi nama, URL opsional, dan urutan. Sponsor tampil di halaman login. Bisa disembunyikan tanpa menghapus.",
        ],
      },
      {
        judul: "Perilaku sistem",
        poin: [
          "Jendela koreksi PIC: berapa bulan ke belakang yang boleh diubah PIC (admin selalu bebas).",
          "Masa retensi: berapa bulan setelah lulus data pribadi + absensi siswa dihapus.",
          "Label status hadir/izin/sakit/alpha bisa diganti (misal: Alfa).",
          "Jumlah rombongan kelas default dan daftar tanggal libur nasional.",
        ],
      },
      {
        judul: "Cadangan mingguan",
        langkah: [
          "Cadangan otomatis dijalankan tiap minggu lewat GitHub Actions (lihat README).",
          "Atau unduh manual: jalankan perintah cadangan yang ada di README, simpan file hasilnya di penyimpanan aman.",
          "Simpan juga kunci .env dan file kunci Google agar cadangan bisa dipulihkan.",
        ],
      },
      {
        judul: "Bila aplikasi terasa lambat",
        poin: [
          "Kurangi jumlah ekskul aktif yang tidak terpakai (arsipkan).",
          "Gunakan filter tanggal yang lebih pendek di laporan.",
          "Bersihkan data lewat menu Retensi bila siswa lulus sudah menumpuk.",
        ],
      },
    ],
  },
];

const PIC: TutorialBab[] = [
  {
    id: "mulai",
    judul: "Mulai & Tampilan",
    ikon: "dashboard",
    ringkasan: "Login, dashboard, dan ganti tema terang/gelap.",
    blok: [
      {
        judul: "Login",
        langkah: [
          "Buka alamat aplikasi, masukkan username dan password dari admin.",
          "Tekan Masuk. Bila akun dinonaktifkan, Anda akan diminta menghubungi admin.",
        ],
      },
      {
        judul: "Akses Anda",
        poin: [
          "PIC hanya melihat dan mengelola ekskul yang ditugaskan admin ke Anda.",
          "Anda bisa mengisi absensi, melihat laporan, dan melihat detail siswa pada ekskul tersebut.",
          "Menu data siswa, pengguna, dan pengaturan tidak tersedia untuk PIC.",
        ],
      },
      {
        judul: "Dashboard",
        poin: [
          "Daftar ekskul Anda beserta sesi hari ini.",
          "Sesi yang belum terisi dan jumlah kehadiran terkini.",
        ],
      },
      {
        judul: "Mode terang / mode gelap",
        langkah: [
          "Tekan ikon matahari/bulan/monitor di sidebar (atau header pada HP).",
          "Urutannya: Ikut sistem → Mode terang → Mode gelap.",
          "Pilihan tersimpan di perangkat Anda.",
        ],
      },
    ],
  },
  {
    id: "absen",
    judul: "Mengisi Absensi",
    ikon: "absen",
    ringkasan: "Langkah mengisi, mengoreksi, dan menandai libur.",
    blok: [
      {
        judul: "Langkah mengisi",
        langkah: [
          "Buka menu Absensi → pilih ekskul Anda.",
          "Pastikan tanggal sesi benar (default hari ini).",
          "Pilih status tiap siswa: Hadir, Izin, Sakit, atau Alpha.",
          "Tambahkan catatan bila perlu (misal: izin lomba).",
          "Tekan Simpan. Jumlah tiap status langsung tampil di ringkasan.",
        ],
      },
      {
        judul: "Koreksi",
        poin: [
          "Anda bisa memperbaiki absensi dalam jangka waktu yang ditetapkan admin (default 6 bulan ke belakang).",
          "Untuk tanggal yang lebih lama, hubungi admin — admin tidak dibatasi jendela waktu.",
          "Semua perubahan tercatat: siapa, kapan, status lama → baru.",
        ],
      },
      {
        judul: "Sesi libur",
        langkah: [
          "Bila ekskul tidak jadi berlangsung, tekan Tandai libur pada tanggal tersebut.",
          "Sesi libur tidak dihitung sebagai sesi terjadwal di laporan.",
          "Tekan sekali lagi untuk membatalkan tanda libur.",
        ],
      },
      {
        judul: "Peringatan sinkronisasi",
        poin: [
          "Absensi tetap tersimpan walau pengiriman ke Google Sheets gagal.",
          "Data masuk antrean dan dikirim ulang otomatis, jadi tidak perlu mengulang simpan.",
        ],
      },
    ],
  },
  {
    id: "laporan",
    judul: "Laporan",
    ikon: "laporan",
    ringkasan: "Rekap kehadiran ekskul Anda dan unduhan CSV.",
    blok: [
      {
        judul: "Melihat laporan",
        langkah: [
          "Buka menu Laporan → pilih ekskul Anda.",
          "Atur rentang tanggal yang ingin dilihat.",
          "Lihat rekap per siswa, grafik harian, dan jumlah sesi terjadwal.",
        ],
      },
      {
        judul: "Ekspor CSV",
        poin: [
          "Tekan Ekspor CSV untuk mengunduh rekap sesuai filter yang dipilih.",
          "Data yang sama juga tersimpan di Google Sheets bila admin sudah mengaturnya.",
        ],
      },
      {
        judul: "Detail siswa",
        poin: [
          "Dari daftar absensi, tekan nama siswa untuk melihat riwayat kehadirannya.",
        ],
      },
    ],
  },
  {
    id: "batasan",
    judul: "Batasan & Bantuan",
    ikon: "help",
    ringkasan: "Yang tidak bisa dilakukan PIC dan ke mana minta bantuan.",
    blok: [
      {
        judul: "Yang tidak bisa dilakukan PIC",
        poin: [
          "Menambah/menghapus siswa, kelas, jurusan, dan tahun ajaran.",
          "Membuat akun pengguna atau mengubah pengaturan aplikasi.",
          "Mengelola ekskul yang tidak ditugaskan kepada Anda.",
          "Mengubah absensi di luar jendela koreksi.",
        ],
      },
      {
        judul: "Bila ada masalah",
        langkah: [
          "Absensi gagal simpan → muat ulang halaman lalu coba sekali lagi.",
          "Siswa tidak muncul → hubungi admin, kemungkinan belum masuk anggota ekskul.",
          "Ingin mengubah data di luar kewenangan → hubungi admin sekolah.",
        ],
      },
    ],
  },
];

export function getTutorial(role: string): TutorialBab[] {
  return role === "admin" ? ADMIN : PIC;
}

export const TUTORIAL_ROLE_LABEL: Record<string, string> = {
  admin: "Tutorial Admin",
  pic: "Tutorial PIC",
};
