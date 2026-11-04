import type { Metadata, Viewport } from "next";
import "./globals.css";
import { hasSupabaseEnv } from "@/lib/env";
import { getAppSettings } from "@/lib/queries/master";
import { lightenHex, sanitizeHex } from "@/lib/utils/format";

export async function generateMetadata(): Promise<Metadata> {
  const settings =
    hasSupabaseEnv() ? await getAppSettings().catch(() => null) : null;

  return {
    title: settings?.nama_sekolah
      ? `${settings.nama_sekolah} - PresenEx`
      : "PresenEx - Absensi Ekstrakurikuler",
    description: "Aplikasi absensi ekstrakurikuler untuk sekolah",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

/**
 * Pasang tema sebelum paint pertama supaya tidak berkedip putih di mode gelap.
 * Nilai "auto" (atau tidak ada pilihan pengguna) berarti ikut sistem.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("presenex.tema");if(t!=="light"&&t!=="dark"&&t!=="auto"){t=document.documentElement.getAttribute("data-tema-bawaan");}if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}else{document.documentElement.removeAttribute("data-theme");}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings =
    hasSupabaseEnv() ? await getAppSettings().catch(() => null) : null;

  const accent = sanitizeHex(settings?.warna_aksen);
  const style = {
    "--accent-light": accent,
    "--accent-dark": lightenHex(accent, 0.34),
  } as React.CSSProperties;

  return (
    <html
      lang="id"
      className="h-full"
      data-tema-bawaan={settings?.tema ?? "auto"}
      style={style}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
