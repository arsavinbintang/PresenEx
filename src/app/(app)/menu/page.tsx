import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/queries/master";
import { logoutAction } from "@/lib/auth/actions";
import { ADMIN_NAV, PIC_NAV } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icons";
import { inisial } from "@/lib/utils/format";
import { formatTanggal } from "@/lib/utils/tanggal";
import { todayISO } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await requireSession();
  const settings = await getAppSettings();
  const isAdmin = session.profile.role === "admin";
  const groups = (isAdmin ? ADMIN_NAV : PIC_NAV)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.href !== "/menu"),
    }))
    .filter((group) => group.items.length > 0);

  const today = todayISO(settings?.timezone ?? "Asia/Jakarta");

  return (
    <div>
      <PageHeader
        title="Menu"
        description={`${settings?.nama_sekolah ?? "Sekolah"} · ${formatTanggal(today)}`}
      />

      <section className="card mb-4 flex items-center gap-3 p-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {inisial(session.profile.nama)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{session.profile.nama}</p>
          <p className="muted truncate text-xs">@{session.profile.username}</p>
        </div>
        <span
          className={isAdmin ? "badge badge-izin" : "badge badge-muted"}
        >
          {isAdmin ? "Admin" : "PIC"}
        </span>
      </section>

      <div className="space-y-4">
        {groups.map((group, index) => (
          <section key={group.title ?? index}>
            {group.title ? (
              <p className="muted mb-1.5 px-1 text-[0.7rem] font-bold uppercase tracking-wider">
                {group.title}
              </p>
            ) : null}
            <div className="card divide-y overflow-hidden">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--accent)",
                    }}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <Icon
                    name="chevron"
                    className="h-4 w-4 text-[var(--muted)]"
                  />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <p className="muted mb-1.5 px-1 text-[0.7rem] font-bold uppercase tracking-wider">
            Akun
          </p>
          <div className="card divide-y overflow-hidden">
            {isAdmin ? (
              <Link
                href="/admin/pengaturan"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--accent)",
                  }}
                >
                  <Icon name="settings" className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm font-medium">Pengaturan</span>
                <Icon name="chevron" className="h-4 w-4 text-[var(--muted)]" />
              </Link>
            ) : null}

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--alpha-soft)",
                    color: "var(--alpha)",
                  }}
                >
                  <Icon name="logout" className="h-[18px] w-[18px]" />
                </span>
                <span
                  className="flex-1 text-sm font-medium"
                  style={{ color: "var(--alpha)" }}
                >
                  Keluar
                </span>
              </button>
            </form>
          </div>
        </section>
      </div>

      <p className="muted mt-6 text-center text-xs">
        PresenEx · data absensi tersimpan di Supabase dan dicadangkan ke Google
        Sheets.
      </p>
    </div>
  );
}
