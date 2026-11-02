export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function persen( bagian: number, total: number): string {
  if (!total) return "-";
  return `${Math.round((bagian / total) * 100)}%`;
}

export function angka(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID").format(value ?? 0);
}

export function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
