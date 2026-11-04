import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listEkskulForUser } from "@/lib/queries/absensi";
import { getAppSettings } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { labelHari, todayISO } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

export default async function AbsenListPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const settings = await getAppSettings();
  const today = todayISO(settings?.timezone ?? "Asia/Jakarta");

  const ekskul = await listEkskulForUser(
    supabase,
    session.profile.id,
    session.profile.role,
  );

  const ids = ekskul.map((e) => e.id);
  const { data: daily } = ids.length
    ? await supabase
        .from("attendance_daily")
        .select("ekskul_id,hadir,total")
        .eq("tanggal", today)
        .in("ekskul_id", ids)
    : { data: [] as Array<{ ekskul_id: string; hadir: number; total: number }> };

  const dailyMap = new Map(
    ((daily ?? []) as Array<{
      ekskul_id: string;
      hadir: number;
      total: number;
    }>).map((row) => [row.ekskul_id, row]),
  );

  return (
    <div>
      <PageHeader
        title="Absensi"
        description="Pilih ekskul untuk mengisi atau mengoreksi sesi."
      />

      {ekskul.length === 0 ? (
        <div className="card">
          <Empty
            icon="school"
            title="Belum ada ekskul"
            description="Admin belum menetapkan ekskul untuk akun ini."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ekskul.map((item) => {
            const hari = (item.ekskul_jadwal ?? [])
              .map((j) => j.hari)
              .sort();
            const row = dailyMap.get(item.id);
            return (
              <Link
                key={item.id}
                href={`/absen/${item.id}`}
                className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  <Icon name="school" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.nama}</p>
                  <p className="muted text-xs">
                    {hari.map((h) => labelHari(h)).join(" & ")}
                  </p>
                </div>
                {row ? (
                  <span className="badge badge-hadir">
                    {row.hadir}/{row.total}
                  </span>
                ) : (
                  <span className="badge badge-muted">Belum</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
