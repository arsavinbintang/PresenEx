import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/env";
import { logoutAction } from "@/lib/auth/actions";
import { ADMIN_NAV, BOTTOM_NAV, PIC_NAV } from "@/lib/nav";
import { SidebarNav, BottomNav } from "@/components/layout/nav";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandMark } from "@/components/ui/brand";
import { inisial } from "@/lib/utils/format";
import { getAppSettings } from "@/lib/queries/master";

export const dynamic = "force-dynamic";

function SetupScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-bold">PresenEx belum dikonfigurasi</h1>
        <p className="muted mt-2 text-sm">
          Buat file <code className="font-mono">.env.local</code> dari{" "}
          <code className="font-mono">.env.example</code>, isi kredensial
          Supabase, lalu jalankan migrasi di{" "}
          <code className="font-mono">supabase/migrations</code> dan{" "}
          <code className="font-mono">npm run seed:admin</code>.
        </p>
        <p className="muted mt-3 text-sm">
          Detail langkah ada di <code className="font-mono">README.md</code>.
        </p>
      </div>
    </main>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) return <SetupScreen />;

  const session = await getSession();
  if (!session) redirect("/login");

  const settings = await getAppSettings();

  const isAdmin = session.profile.role === "admin";
  const groups = isAdmin ? ADMIN_NAV : PIC_NAV;

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-[var(--surface)] px-3 py-4 md:flex">
        <Link href="/dashboard" className="mb-5 flex items-center gap-2 px-2">
          <BrandMark settings={settings} size="md" />
        </Link>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={groups} />
        </div>

        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--surface-2)", color: "var(--accent)" }}
            >
              {inisial(session.profile.nama)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {session.profile.nama}
              </span>
              <span className="muted block text-[0.68rem] uppercase">
                {session.profile.role}
              </span>
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn btn-ghost btn-sm !min-h-8 !px-2"
                title="Keluar"
              >
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-[var(--surface)] px-4 py-2.5 md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <BrandMark settings={settings} size="sm" />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: "var(--surface-2)", color: "var(--accent)" }}
          >
            {inisial(session.profile.nama)}
          </Link>
        </div>
      </header>

      <main className="pb-20 md:pb-8 md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-7">
          {children}
        </div>
      </main>

      <BottomNav items={BOTTOM_NAV} />
    </div>
  );
}

export type LayoutSettings = Awaited<ReturnType<typeof getAppSettings>>;
export type { CSSProperties };
