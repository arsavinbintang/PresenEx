import { assetUrl } from "@/lib/utils/asset";
import type { AppSettings } from "@/types/db";
import { cn } from "@/lib/utils/format";

/**
 * Logo aplikasi. Memakai logo yang diunggah admin bila ada,
 * kalau tidak memakai ubin "P" bawaan.
 */
export function BrandMark({
  settings,
  size = "md",
  className,
}: {
  settings: Pick<AppSettings, "logo_path" | "nama_sekolah"> | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const url = assetUrl(settings?.logo_path);
  const box =
    size === "sm"
      ? "h-7 w-7 rounded-lg text-sm"
      : size === "lg"
        ? "h-14 w-14 rounded-2xl text-xl"
        : "h-9 w-9 rounded-xl text-base";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Logo ${settings?.nama_sekolah ?? "PresenEx"}`}
        className={cn(
          "shrink-0 object-contain",
          size === "sm" ? "h-7 w-7" : size === "lg" ? "h-14 w-14" : "h-9 w-9",
          className,
        )}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-white",
        box,
        className,
      )}
      style={{ background: "var(--accent)" }}
    >
      P
    </span>
  );
}
