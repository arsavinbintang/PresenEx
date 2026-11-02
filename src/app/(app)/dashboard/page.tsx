import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  getAdminDashboard,
  getPicDashboard,
} from "@/lib/queries/dashboard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { TrendChart } from "@/components/ui/trend-chart";
import { Empty } from "@/components/ui/empty";
import { Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { persen } from "@/lib/utils/format";
import { formatTanggalPendek, labelHari } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  if (session.profile.role === "admin") {
    const data = await getAdminDashboard(supabase);

    return (
      <div>
        <PageHeader
          title="Dashboard"
          description={`${data.todayLabel}${data.activeTA ? ` · TA ${data.activeTA}` : ""}`}
          action={
            <Link href="/absen" className="btn btn-primary btn-sm">
              <Icon name="absen" className="h-4 w-4" />
              Isi absensi
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Ekskul aktif"
            value={data.totalEkskul}
            hint="Terdaftar di sistem"
            tone="accent"
          />
          <StatCard
            label="Siswa aktif"
            value={data.totalSiswa}
            hint="Lintas kelas"
          />
          <StatCard
            label="Kehadiran 30 hari"
            value={data.total30 ? persen(data.hadir30, data.total30) : "-"}
            hint={`${data.hadir30} dari ${data.total30} catatan`}
            tone="hadir"
          />
          <StatCard
            label="Cakupan 30 hari"
            value={
              data.coverage.terjadwal
                ? persen(data.coverage.tercatat, data.coverage.terjadwal)
                : "-"
            }
            hint={`${data.coverage.tercatat} dari ${data.coverage.terjadwal} sesi`}
            tone={
              data.coverage.terjadwal &&
              data.coverage.tercatat / data.coverage.terjadwal < 0.8
                ? "alpha"
                : "muted"
            }
          />
        </div>

        {data.pendingJobs > 0 ? (
          <div className="mt-3">
            <Notice tone="warning">
              {data.pendingJobs} sesi menunggu sinkronisasi ke Google Sheets.{" "}
              <Link href="/admin/sinkronisasi" className="underline">
                Buka sinkronisasi
              </Link>
            </Notice>
          </div>
        ) : null}

        {data.retentionCount > 0 ? (
          <div className="mt-3">
            <Notice tone="danger">
              {data.retentionCount} siswa lulus sudah melewati masa retensi dan
              siap dihapus.{" "}
              <Link href="/admin/retensi" className="underline">
                Tinjau retensi
              </Link>
            </Notice>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">Jadwal hari ini</h2>
              <span className="muted text-xs">{data.todayLabel}</span>
            </div>

            {data.todaySessions.length === 0 ? (
              <Empty
                icon="calendar"
                title="Tidak ada ekskul hari ini"
                description="Tidak ada jadwal pertemuan yang cocok dengan hari ini."
              />
            ) : (
              <ul className="divide-y">
                {data.todaySessions.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/absen/${item.id}`}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {item.nama}
                      </Link>
                      <p className="muted text-xs">
                        {item.hari.map((h) => labelHari(h)).join(" & ")}
                      </p>
                    </div>
                    {item.terisi ? (
                      <span className="badge badge-hadir">
                        <Icon name="check" className="h-3 w-3" />
                        {item.hadir}/{item.total}
                      </span>
                    ) : (
                      <span className="badge badge-sakit">
                        <Icon name="alert" className="h-3 w-3" />
                        Belum
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">Tren 6 bulan</h2>
              <span className="muted text-xs">Kehadiran</span>
            </div>
            <TrendChart points={data.trend} height={130} />
          </section>
        </div>

        <section className="card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Perlu perhatian</h2>
            <span className="muted text-xs">30 hari terakhir</span>
          </div>

          {data.attention.length === 0 ? (
            <Empty
              icon="check"
              title="Semua ekskul aman"
              description="Tidak ada ekskul dengan kehadiran rendah atau sesi yang terlewat."
            />
          ) : (
            <ul className="divide-y">
              {data.attention.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ekskul/${item.id}`}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {item.nama}
                    </Link>
                    <p className="muted text-xs">
                      {item.total === 0
                        ? "Belum ada absensi dalam 30 hari"
                        : `Kehadiran ${persen(item.hadir, item.total)} dari ${item.total} catatan`}
                    </p>
                  </div>
                  <span
                    className={
                      item.total === 0 || item.ratio < 0.7
                        ? "badge badge-alpha"
                        : "badge badge-sakit"
                    }
                  >
                    {item.total === 0 ? "Terlewat" : persen(item.hadir, item.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const data = await getPicDashboard(supabase, session.profile.id);

  return (
    <div>
      <PageHeader
        title={`Halo, ${session.profile.nama.split(" ")[0]}`}
        description={data.todayLabel}
      />

      {data.cards.length === 0 ? (
        <div className="card">
          <Empty
            icon="school"
            title="Belum ada ekskul"
            description="Admin belum menetapkan ekskul untuk akun ini."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {data.cards.map((card) => (
            <section key={card.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-bold">{card.nama}</h2>
                  <p className="muted text-xs">Setiap {card.jadwalLabel}</p>
                </div>
                {card.todayScheduled ? (
                  <span className="badge badge-sakit">Jadwal hari ini</span>
                ) : (
                  <span className="badge badge-muted">Bukan hari ini</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="muted text-xs">Sesi terakhir</p>
                  <p className="font-semibold">
                    {card.lastDate
                      ? formatTanggalPendek(card.lastDate)
                      : "Belum ada"}
                  </p>
                  {card.lastDate ? (
                    <p className="muted text-xs">
                      {card.lastHadir}/{card.lastTotal} hadir
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="muted text-xs">Jadwal berikutnya</p>
                  <p className="font-semibold">
                    {card.nextDate
                      ? formatTanggalPendek(card.nextDate)
                      : "-"}
                  </p>
                  {card.nextDate ? (
                    <p className="muted text-xs">{labelHari(card.hari[0])}</p>
                  ) : null}
                </div>
              </div>

              {card.trend.length > 0 ? (
                <div className="mt-3">
                  <TrendChart points={card.trend} height={70} />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/absen/${card.id}`}
                  className="btn btn-primary btn-sm flex-1 sm:flex-none"
                >
                  <Icon name="absen" className="h-4 w-4" />
                  Isi absensi
                </Link>
                <Link
                  href={`/ekskul/${card.id}`}
                  className="btn btn-ghost btn-sm flex-1 sm:flex-none"
                >
                  Lihat detail
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}

      {data.pendingJobs > 0 ? (
        <div className="mt-4">
          <Notice tone="info">
            {data.pendingJobs} sesi sedang menunggu backup ke Google Sheets.
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
