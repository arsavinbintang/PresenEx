import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { hasSupabaseEnv } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { getAppSettings, getSponsors } from "@/lib/queries/master";
import { BrandMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { assetUrl } from "@/lib/utils/asset";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = hasSupabaseEnv();
  const session = configured ? await getSession() : null;

  if (session) redirect("/dashboard");

  const [settings, sponsors] = configured
    ? await Promise.all([getAppSettings(), getSponsors()])
    : [null, []];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <BrandMark settings={settings} size="lg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {settings?.nama_sekolah ?? "PresenEx"}
          </h1>
          <p className="muted mt-1 text-sm">
            Absensi ekstrakurikuler sekolah
          </p>
        </div>

        <div className="card p-5">
          {configured ? (
            <LoginForm />
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Supabase belum dikonfigurasi</p>
              <p className="muted">
                Salin <code className="font-mono">.env.example</code> menjadi{" "}
                <code className="font-mono">.env.local</code>, isi URL dan anon
                key Supabase, lalu jalankan migrasi di folder{" "}
                <code className="font-mono">supabase/migrations</code>.
              </p>
              <pre className="overflow-x-auto rounded-lg bg-[var(--surface-2)] p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
              </pre>
            </div>
          )}
        </div>

        {sponsors.length > 0 ? (
          <div className="mt-6">
            <p className="muted mb-2 text-center text-[0.68rem] font-bold uppercase tracking-wider">
              Didukung oleh
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {sponsors.map((sponsor) => {
                const url = assetUrl(sponsor.path);
                const logo = url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={sponsor.nama}
                    className="max-h-10 w-auto max-w-[120px] object-contain"
                    loading="lazy"
                  />
                ) : null;

                return sponsor.url && logo ? (
                  <a
                    key={sponsor.id}
                    href={sponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={sponsor.nama}
                    className="rounded-xl border bg-[var(--surface)] px-3 py-2 transition-opacity hover:opacity-80"
                  >
                    {logo}
                  </a>
                ) : (
                  <span
                    key={sponsor.id}
                    title={sponsor.nama}
                    className="rounded-xl border bg-[var(--surface)] px-3 py-2"
                  >
                    {logo}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="muted mt-6 text-center text-xs">
          Data absensi tersimpan di Supabase dan dicadangkan ke Google Sheets.
        </p>
      </div>
    </main>
  );
}
