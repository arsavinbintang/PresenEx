import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAttendancePageData } from "@/lib/queries/absensi";
import { getSettings } from "@/lib/queries/master";
import { AttendanceForm } from "@/components/absensi/attendance-form";
import { LiburToggle } from "@/components/absensi/libur-toggle";
import { Icon } from "@/components/ui/icons";
import { addMonths, formatTanggal, labelHari } from "@/lib/utils/tanggal";
import type { AttendanceStatus } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AbsenDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ekskulId: string }>;
  searchParams: Promise<{ tanggal?: string }>;
}) {
  const { ekskulId } = await params;
  const { tanggal: tanggalParam } = await searchParams;

  const session = await requireSession();
  const supabase = await createClient();

  if (session.profile.role !== "admin") {
    const { data: link } = await supabase
      .from("ekskul_pic")
      .select("ekskul_id")
      .eq("ekskul_id", ekskulId)
      .eq("profile_id", session.profile.id)
      .maybeSingle();
    if (!link) notFound();
  }

  const [data, settings] = await Promise.all([
    getAttendancePageData(supabase, ekskulId, tanggalParam),
    getSettings(supabase),
  ]);

  if (!data) notFound();

  const canEdit =
    session.profile.role === "admin"
      ? data.tanggal <= data.today
      : data.canEdit;

  const labels: Record<AttendanceStatus, string> = {
    hadir: settings?.label_hadir ?? "Hadir",
    izin: settings?.label_izin ?? "Izin",
    sakit: settings?.label_sakit ?? "Sakit",
    alpha: settings?.label_alpha ?? "Alpha",
  };

  const windowMin = addMonths(
    data.today,
    -(settings?.edit_window_months ?? data.windowMonths),
  );

  return (
    <div>
      <div className="mb-4 flex items-start gap-2">
        <Link
          href="/absen"
          className="btn btn-ghost btn-sm !min-h-9 !px-2"
          aria-label="Kembali"
        >
          <Icon name="back" className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">
            {data.ekskul.nama}
          </h1>
          <p className="muted text-xs">
            Jadwal: {data.hari.map((h) => labelHari(h)).join(" & ") || "-"}
          </p>
        </div>
        <LiburToggle
          ekskulId={ekskulId}
          tanggal={data.tanggal}
          libur={data.isLibur}
        />
      </div>

      <div className="card mb-4 p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="tanggal">
              Tanggal sesi
            </label>
            <input
              id="tanggal"
              type="date"
              name="tanggal"
              defaultValue={data.tanggal}
              min={windowMin}
              max={data.today}
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-ghost">
            Buka
          </button>
        </form>
        <p className="muted mt-2 text-xs">
          {formatTanggal(data.tanggal)} · jendela koreksi{" "}
          {settings?.edit_window_months ?? data.windowMonths} bulan untuk PIC.
        </p>
      </div>

      {data.isLibur ? (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--sakit-soft)", color: "var(--sakit)" }}
        >
          Sesi ini ditandai libur. Tanda libur dapat dibatalkan dari tombol di
          kanan atas.
        </div>
      ) : null}

      <div className="mb-4">
        <p className="muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
          Sesi terakhir
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.history.map((item) => (
            <Link
              key={item.tanggal}
              href={`/absen/${ekskulId}?tanggal=${item.tanggal}`}
              className="card flex min-w-[7.5rem] flex-col gap-0.5 px-3 py-2 text-xs"
              style={
                item.tanggal === data.tanggal
                  ? { borderColor: "var(--accent)" }
                  : undefined
              }
            >
              <span className="font-semibold">
                {formatTanggal(item.tanggal).replace(/,.*/, "")}
              </span>
              <span className="muted">
                {item.tanggal.slice(5).replace("-", "/")}
              </span>
              {item.terisi ? (
                <span className="badge badge-hadir mt-1 w-fit">
                  {item.hadir}/{item.total}
                </span>
              ) : (
                <span className="badge badge-sakit mt-1 w-fit">Belum</span>
              )}
            </Link>
          ))}
          {data.history.length === 0 ? (
            <span className="muted text-sm">Belum ada sesi terjadwal.</span>
          ) : null}
        </div>
      </div>

      <AttendanceForm
        ekskulId={ekskulId}
        tanggal={data.tanggal}
        roster={data.roster}
        canEdit={canEdit}
        labels={labels}
        isScheduled={data.isScheduled}
      />
    </div>
  );
}
