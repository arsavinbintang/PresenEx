import type { NavGroup, NavItem } from "@/components/layout/nav";

export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/absen", label: "Absen", icon: "absen" },
  { href: "/laporan", label: "Laporan", icon: "laporan" },
  { href: "/menu", label: "Lainnya", icon: "menu" },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/absen", label: "Absensi", icon: "absen" },
      { href: "/ekskul", label: "Ekskul", icon: "school" },
      { href: "/laporan", label: "Laporan", icon: "laporan" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/admin/siswa", label: "Siswa", icon: "users" },
      { href: "/admin/kelas", label: "Kelas", icon: "calendar" },
      { href: "/admin/jurusan", label: "Jurusan", icon: "archive" },
      { href: "/admin/tahun-ajaran", label: "Tahun ajaran", icon: "clock" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/pengguna", label: "Pengguna", icon: "user" },
      { href: "/admin/sinkronisasi", label: "Sinkronisasi", icon: "sync" },
      { href: "/admin/retensi", label: "Retensi", icon: "trash" },
      { href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" },
    ],
  },
  {
    title: "Bantuan",
    items: [{ href: "/tutorial", label: "Tutorial", icon: "help" }],
  },
];

export const PIC_NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", exact: true },
      { href: "/absen", label: "Absensi", icon: "absen" },
      { href: "/laporan", label: "Laporan", icon: "laporan" },
      { href: "/menu", label: "Menu", icon: "menu" },
      { href: "/tutorial", label: "Tutorial", icon: "help" },
    ],
  },
];
