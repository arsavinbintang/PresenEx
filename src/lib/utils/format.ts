export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function persen(bagian: number, total: number): string {
  if (!total) return "-";
  return `${Math.round((bagian / total) * 100)}%`;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function sanitizeHex(value: string | null | undefined, fallback = "#2563eb"): string {
  const match = (value ?? "").trim().match(HEX_RE);
  if (!match) return fallback;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toLowerCase()}`;
}

/**
 * Terangkan warna hex untuk tema gelap agar tetap kontras.
 * amount 0–1 (0.18 ≈ naik 18% terang).
 */
export function lightenHex(value: string | null | undefined, amount = 0.18): string {
  const hex = sanitizeHex(value).slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const f = (c: number) => Math.round(c + (255 - c) * amount);
  const to2 = (c: number) => c.toString(16).padStart(2, "0");
  return `#${to2(f(r))}${to2(f(g))}${to2(f(b))}`;
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
