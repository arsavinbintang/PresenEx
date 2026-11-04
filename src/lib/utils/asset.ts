import { SUPABASE_URL } from "@/lib/env";

export const ASSET_BUCKET = "presenex-assets";

const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp", "svg", "gif", "avif"];
export const MAX_ASSET_BYTES = 1_500_000; // 1.5 MB

/** Ubah path di bucket menjadi URL publik. Juga menerima URL absolut apa adanya. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!SUPABASE_URL) return null;
  const clean = path.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSET_BUCKET}/${clean}`;
}

export interface FileCheck {
  ok: boolean;
  reason?: string;
}

export function validateImageFile(file: File | null | undefined): FileCheck {
  if (!file || file.size === 0) return { ok: false, reason: "Pilih gambar dulu." };
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "File harus berupa gambar (PNG/JPG/WEBP/SVG)." };
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, reason: `Format .${ext} belum didukung.` };
  }
  if (file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      reason: "Ukuran gambar maksimal 1,5 MB. Kompres dulu gambarnya.",
    };
  }
  return { ok: true };
}
