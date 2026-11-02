export const HARI = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function labelHari(hari: number): string {
  return HARI[hari - 1] ?? "-";
}

export function labelHariPendek(hari: number): string {
  return HARI_PENDEK[hari - 1] ?? "-";
}

/** 1 = Senin ... 7 = Minggu */
export function isodow(tanggal: string): number {
  const day = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function formatTanggal(tanggal: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${tanggal}T00:00:00Z`));
}

export function formatTanggalPendek(tanggal: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${tanggal}T00:00:00Z`));
}

export function formatTanggalLengkapPendek(tanggal: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${tanggal}T00:00:00Z`));
}

export function todayISO(timezone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addMonths(tanggal: string, months: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addDays(tanggal: string, days: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthKey(tanggal: string): string {
  return tanggal.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${BULAN[m - 1] ?? "-"} ${y}`;
}

export function monthLabelShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${BULAN[m - 1]?.slice(0, 3) ?? "-"} ${String(y).slice(2)}`;
}

export function rangeMonths(endKey: string, count: number): string[] {
  const [y, m] = endKey.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out;
}

export function romanTingkat(tingkat: number): string {
  if (tingkat === 10) return "X";
  if (tingkat === 11) return "XI";
  if (tingkat === 12) return "XII";
  return String(tingkat);
}

export function labelKelas(kelas?: {
  tingkat?: number | null;
  jurusan_kode?: string | null;
  nomor?: number | null;
} | null): string {
  if (!kelas?.tingkat || !kelas?.nomor) return "-";
  return [romanTingkat(kelas.tingkat), kelas.jurusan_kode, kelas.nomor]
    .filter(Boolean)
    .join(" ");
}
