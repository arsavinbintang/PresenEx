export type Role = "admin" | "pic";
export type AttendanceStatus = "hadir" | "izin" | "sakit" | "alpha";
export type StudentStatus = "aktif" | "lulus" | "keluar";

export interface Profile {
  id: string;
  username: string;
  nama: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export type Tema = "auto" | "light" | "dark";

export interface AppSettings {
  id: boolean;
  nama_sekolah: string;
  timezone: string;
  warna_aksen: string;
  edit_window_months: number;
  purge_after_months: number;
  purge_sheets: boolean;
  label_hadir: string;
  label_izin: string;
  label_sakit: string;
  label_alpha: string;
  backup_drive_folder_id: string | null;
  tema: Tema;
  logo_path: string | null;
  login_banner_path: string | null;
  updated_at: string;
}

export interface Sponsor {
  id: string;
  nama: string;
  url: string | null;
  urutan: number;
  path: string;
  is_active: boolean;
  created_at: string;
}

export interface TahunAjaran {
  id: string;
  nama: string;
  mulai: string;
  selesai: string;
  is_active: boolean;
  created_at: string;
}

export interface Jurusan {
  id: string;
  kode: string;
  nama: string;
  kelas_per_tingkat: number;
  is_active: boolean;
  created_at: string;
}

export interface Kelas {
  id: string;
  tahun_ajaran_id: string;
  jurusan_id: string;
  tingkat: number;
  nomor: number;
}

export interface Student {
  id: string;
  nama: string;
  nis: string | null;
  kelas_id: string | null;
  status: StudentStatus;
  lulus_at: string | null;
  purge_hold: boolean;
  created_at: string;
}

export interface Ekskul {
  id: string;
  nama: string;
  deskripsi: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EkskulJadwal {
  ekskul_id: string;
  hari: number;
}

export interface EkskulPic {
  ekskul_id: string;
  profile_id: string;
  is_primary: boolean;
}

export interface Member {
  id: string;
  ekskul_id: string;
  student_id: string;
  joined_at: string;
  left_at: string | null;
}

export interface Attendance {
  id: string;
  ekskul_id: string;
  member_id: string;
  student_id: string;
  kelas_id: string | null;
  tanggal: string;
  status: AttendanceStatus;
  catatan: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceDaily {
  ekskul_id: string;
  tanggal: string;
  total: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  updated_at: string;
}

export interface SheetConfig {
  id: string;
  tahun_ajaran_id: string;
  spreadsheet_id: string;
  is_active: boolean;
  created_at: string;
}

export interface SheetSyncJob {
  id: number;
  ekskul_id: string;
  tanggal: string;
  action: "upsert" | "delete";
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  run_after: string;
  locked_at: string | null;
  updated_at: string;
}

export interface LaporanRow {
  student_id: string;
  nama: string;
  nis: string | null;
  kelas: string;
  sesi: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
}
