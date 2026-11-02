import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listEkskulForUser } from "@/lib/queries/absensi";
import { getActiveTA, getSettings } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import {
  addMonths,
  formatTanggalLengkapPendek,
  formatTanggalPendek,
  todayISO,
} from "@/lib/utils/tanggal";
import { persen } from "@/lib/utils/format";
import type { LaporanRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    ekskul?: string;
    dari?: string;
    sampai?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  const [settings, activeTA] = await Promise.all([
    getSettings(supabase),
    getActiveTA(supabase),
  ]);
  const today = todayISO(settings?.timezone ?? "Asia/Jakarta");

  const ekskulList = await listEkskulForUser(
    supabase,
    session.profile.id,
    session.profile.role,
  );

  const selected =
    ekskulList.find((item) => item.id === params.ekskul) ??
    ekskulList[0] ??
    null;

  const dari =
    params.dari && /^\d{4}-\d{2}-\d{2}$/.test(params.dari)
      ? params.dari
      : activeTA && activeTA.mulai <= today
        ? activeTA.mulai
        : addMonths(today, -3);
  const sampai =
    params.sampai && /^\d{4}-\d{2}-\d{2}$/.test(params.sampai)
      ? params.sampai
      : today;

  let rows: LaporanRow[] = [];
  let daily: Array<{ tanggal: string; total: number; hadir: number }> = [];
  let terjadwal = 0;

  if (selected) {
    const [laporanRes, dailyRes, jadwalRes] = await Promise.all([
      supabase.rpc("laporan_kehadiran", {
        p_ekskul: selected.id,
        p_dari: dari,
        p_sampai: sampai,
      }),
      supabase
        .from("attendance_daily")
        .select("tanggal,total,hadir")
        .eq("ekskul_id", selected.id)
        .gte("tanggal", dari)
        .lte("tanggal", sampai)
        .order("tanggal"),
      supabase.rpc("sesi_terjadwal", {
        p_ekskul: selected.id,
        p_dari: dari,
        p_sampai: sampai,
      }),
    ]);

    rows = (laporanRes.data ?? []) as LaporanRow[];
    daily = (dailyRes.data ?? []) as Array<{
      tanggal: string;
      total: number;
      hadir: number;
    }>;
    terjadwal = Array.isArray(jadwalRes.data) ? jadwalRes.data.length : 0;
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.sesi += row.sesi;
      acc.hadir += row.hadir;
      acc.izin += row.izin;
      acc.sakit += row.sakit;
      acc.alpha += row.alpha;
      return acc;
    },
    { sesi: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
  );

  const sesiTercatat = daily.length;
  const totalCatatan = daily.reduce((sum, row) => sum + row.total, 0);
  const totalHadir = daily.reduce((sum, row) => sum + row.hadir, 0);

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={
          selected
            ? `${selected.nama} · ${formatTanggalPendek(dari)} – ${formatTanggalPendek(sampai)}`
            : "Rekap kehadiran per ekskul"
        }
        action={
          selected ? (
            <a
              href={`/api/laporan/export?ekskul=${selected.id}&dari=${dari}&sampai=${sampai}`}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="download" className="h-4 w-4" />
              CSV
            </a>
          ) : undefined
        }
      />

      {ekskulList.length === 0 ? (
        <div className="card">
          <Empty
            icon="laporan"
            title="Belum ada ekskul"
            description="Laporan tersedia setelah admin menetapkan ekskul."
          />
        </div>
      ) : (
        <>
          <div className="card mb-4 p-3">
            <form method="get" className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ekskul">
                  Ekskul
                </label>
                <select
                  id="ekskul"
                  name="ekskul"
                  defaultValue={selected?.id ?? ""}
                  className="select"
                >
                  {ekskulList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dari">
                  Dari
                </label>
                <input
                  id="dari"
                  type="date"
                  name="dari"
                  className="input"
                  defaultValue={dari}
                />
              </div>
              <div>
                <label className="label" htmlFor="sampai">
                  Sampai
                </label>
                <input
                  id="sampai"
                  type="date"
                  name="sampai"
                  className="input"
                  defaultValue={sampai}
                />
              </div>
              <div className="sm:col-span-4">
                <button type="submit" className="btn btn-primary btn-sm w-full sm:w-auto">
                  Tampilkan
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <p className="muted text-xs font-semibold uppercase">Sesi tercatat</p>
              <p className="text-2xl font-bold tabular-nums">{sesiTercatat}</p>
              <p className="muted text-xs">dari {terjadwal} sesi terjadwal</p>
            </div>
            <div className="card p-4">
              <p className="muted text-xs font-semibold uppercase">Kehadiran</p>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--hadir)" }}
              >
                {totalCatatan ? persen(totalHadir, totalCatatan) : "-"}
              </p>
              <p className="muted text-xs">
                {totalHadir} dari {totalCatatan} catatan
              </p>
            </div>
            <div className="card p-4">
              <p className="muted text-xs font-semibold uppercase">Izin + sakit</p>
              <p className="text-2xl font-bold tabular-nums">
                {totals.izin + totals.sakit}
              </p>
              <p className="muted text-xs">
                {totals.izin} izin · {totals.sakit} sakit
              </p>
            </div>
            <div className="card p-4">
              <p className="muted text-xs font-semibold uppercase">Alpha</p>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--alpha)" }}
              >
                {totals.alpha}
              </p>
              <p className="muted text-xs">dari {totals.sesi} catatan siswa</p>
            </div>
          </div>

          <section className="card mt-4 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Rekap per siswa</h2>
              <span className="muted text-xs">{rows.length} siswa</span>
            </div>

            {rows.length === 0 ? (
              <Empty
                icon="laporan"
                title="Tidak ada data pada rentang ini"
                description="Coba perluas rentang tanggal atau pilih ekskul lain."
              />
            ) : (
              <div className="table-wrap -mx-1">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th className="hidden sm:table-cell">Kelas</th>
                      <th className="text-center">H</th>
                      <th className="text-center">I</th>
                      <th className="text-center">S</th>
                      <th className="text-center">A</th>
                      <th className="text-right">Hadir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.student_id}>
                        <td>
                          <Link
                            href={`/siswa/${row.student_id}`}
                            className="font-medium hover:underline"
                          >
                            {row.nama}
                          </Link>
                          <p className="muted text-xs sm:hidden">
                            {row.kelas} · {row.nis ?? "tanpa NIS"}
                          </p>
                        </td>
                        <td className="muted hidden text-sm sm:table-cell">
                          {row.kelas}
                        </td>
                        <td className="text-center tabular-nums">{row.hadir}</td>
                        <td className="text-center tabular-nums">{row.izin}</td>
                        <td className="text-center tabular-nums">{row.sakit}</td>
                        <td
                          className="text-center tabular-nums"
                          style={{ color: row.alpha > 0 ? "var(--alpha)" : undefined }}
                        >
                          {row.alpha}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {persen(row.hadir, row.sesi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="muted mt-3 text-xs">
            H = hadir, I = izin, S = sakit, A = alpha. Persentase dihitung dari
            catatan absensi yang tersimpan. Sesi libur tidak dihitung sebagai
            sesi terjadwal.
            {daily.length > 0
              ? ` Sesi terakhir ${formatTanggalLengkapPendek(
                  daily[daily.length - 1]?.tanggal ?? sampai,
                )}.`
              : ""}
          </p>
        </>
      )}
    </div>
  );
}
