import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { hasSupabaseEnv } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = hasSupabaseEnv();
  const session = configured ? await getSession() : null;

  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            P
          </div>
          <h1 className="text-xl font-bold tracking-tight">PresenEx</h1>
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

        <p className="muted mt-6 text-center text-xs">
          Data absensi tersimpan di Supabase dan dicadangkan ke Google Sheets.
        </p>
      </div>
    </main>
  );
}
