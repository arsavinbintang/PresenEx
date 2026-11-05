import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getKelasMap } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { formatTanggalPendek } from "@/lib/utils/tanggal";
import type { AttendanceStatus, Student } from "@/types/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpha: "Alpha",
};

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  hadir: "badge badge-hadir",
  izin: "badge badge-izin",
  sakit: "badge badge-sakit",
  alpha: "badge badge-alpha",
};

const STATUS_WARNA: Record<AttendanceStatus, string> = {
  hadir: "var(--hadir)",
  izin: "var(--izin)",
  sakit: "var(--sakit)",
  alpha: "var(--alpha)",
};

type Periode = "7" | "30" | "180" | "semua";

const PERIODE_LABEL: Record<Periode, string> = {
  "7": "7 hari",
  "30": "30 hari",
  "180": "6 bulan",
  semua: "Semua",
};

function rentangDari(periode: Periode): string | null {
  if (periode === "semua") return null;
  const hari = Number(periode);
  const tanggal = new Date();
  tanggal.setHours(12, 0, 0, 0);
  tanggal.setDate(tanggal.getDate() - hari);
  return tanggal.toISOString().slice(0, 10);
}

function bulanEnamTerakhir(): Array<{ kunci: string; label: string }> {
  const hasil: Array<{ kunci: string; label: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    hasil.push({
      kunci: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", { month: "short" }),
    });
  }
  return hasil;
}

interface AttendanceRow {
  id: string;
  tanggal: string;
  status: AttendanceStatus;
  catatan: string | null;
  ekskul: { nama: string } | null;
}

export default async function SiswaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const periode: Periode =
    sp.periode === "7" || sp.periode === "180" || sp.periode === "semua"
      ? sp.periode
      : "30";

  const session = await requireSession();
  const supabase = await createClient();
  const isAdmin = session.profile.role === "admin";

  const { data: studentData } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!studentData) notFound();
  const student = studentData as Student;

  const dari = rentangDari(periode);
  const enamBulanLalu = rentangDari("180");

  const [kelasMap, membersRes, attendanceRes, chartRes] = await Promise.all([
    getKelasMap(supabase),
    supabase
      .from("members")
      .select("id,joined_at,left_at,ekskul:ekskul_id(id,nama)")
      .eq("student_id", id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id,tanggal,status,catatan,ekskul:ekskul_id(nama)")
      .eq("student_id", id)
      .gte("tanggal", dari ?? "1970-01-01")
      .order("tanggal", { ascending: false })
      .limit(500),
    supabase
      .from("attendance")
      .select("tanggal,status")
      .eq("student_id", id)
      .gte("tanggal", enamBulanLalu)
      .order("tanggal", { ascending: false })
      .limit(2000),
  ]);

  const memberships = (membersRes.data ?? []) as unknown as Array<{
    id: string;
    joined_at: string;
    left_at: string | null;
    ekskul: { id: string; nama: string } | null;
  }>;

  const attendance = (attendanceRes.data ?? []) as unknown as AttendanceRow[];

  const counts = attendance.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { hadir: 0, izin: 0, sakit: 0, alpha: 0 } as Record<
      AttendanceStatus,
      number
    >,
  );

  // Grafik 6 bulan terakhir dari data absensi yang sudah ada.
  const chartRows = (chartRes.data ?? []) as Array<{
    tanggal: string;
    status: AttendanceStatus;
  }>;
  const perBulan = new Map<
    string,
    { total: number } & Record<AttendanceStatus, number>
  >();
  for (const bulan of bulanEnamTerakhir()) {
    perBulan.set(bulan.kunci, { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 });
  }
  for (const row of chartRows) {
    const kunci = row.tanggal.slice(0, 7);
    const bucket = perBulan.get(kunci);
    if (!bucket) continue;
    bucket.total += 1;
    bucket[row.status] += 1;
  }
  const maksBulan = Math.max(
    1,
    ...Array.from(perBulan.values()).map((b) => b.total),
  );

  // Rekap per ekskul untuk periode terpilih.
  const perEkskul = new Map<
    string,
    { total: number; sesi: Set<string> } & Record<AttendanceStatus, number>
  >();
  for (const row of attendance) {
    const nama = row.ekskul?.nama ?? "Ekskul";
    let bucket = perEkskul.get(nama);
    if (!bucket) {
      bucket = { total: 0, sesi: new Set(), hadir: 0, izin: 0, sakit: 0, alpha: 0 };
      perEkskul.set(nama, bucket);
    }
    bucket.total += 1;
    bucket.sesi.add(row.tanggal);
    bucket[row.status] += 1;
  }
  const rekapEkskul = Array.from(perEkskul.entries())
    .map(([nama, value]) => ({
      nama,
      sesi: value.sesi.size,
      total: value.total,
      hadir: value.hadir,
      izin: value.izin,
      sakit: value.sakit,
      alpha: value.alpha,
      persen: value.total > 0 ? Math.round((value.hadir / value.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Link
          href={isAdmin ? "/admin/siswa" : "/dashboard"}
          className="btn btn-ghost btn-sm !min-h-9 !px-2"
          aria-label="Kembali"
        >
          <Icon name="back" className="h-4 w-4" />
        </Link>
        <span className="muted text-xs">Detail siswa</span>
      </div>

      <PageHeader
        title={student.nama}
        description={`${student.kelas_id ? (kelasMap.get(student.kelas_id)?.label ?? "-") : "Tanpa kelas"} · ${student.nis ? `NIS ${student.nis}` : "Tanpa NIS"} · ${student.status === "aktif" ? "Siswa aktif" : student.status === "lulus" ? "Sudah lulus" : "Sudah keluar"}`}
        action={
          isAdmin ? (
            <Link
              href={`/admin/siswa?edit=${student.id}`}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="edit" className="h-4 w-4" />
              Ubah
            </Link>
          ) : undefined
        }
      />

      {/* Filter periode: semua angka di bawah mengikuti pilihan ini. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(PERIODE_LABEL) as Periode[]).map((item) => {
          const aktif = item === periode;
          return (
            <Link
              key={item}
              href={`/siswa/${student.id}?periode=${item}`}
              className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
              style={
                aktif
                  ? {
                      background: "var(--accent)",
                      borderColor: "var(--accent)",
                      color: "#fff",
                    }
                  : { color: "var(--muted)" }
              }
            >
              {PERIODE_LABEL[item]}
            </Link>
          );
        })}
        <span className="muted self-center text-xs">
          {periode === "semua"
            ? "menampilkan semua data"
            : `${PERIODE_LABEL[periode]} terakhir`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["hadir", "izin", "sakit", "alpha"] as AttendanceStatus[]).map(
          (status) => (
            <div key={status} className="card p-4">
              <p className="muted text-xs font-semibold uppercase">
                {STATUS_LABEL[status]}
              </p>
              <p className="text-2xl font-bold tabular-nums">{counts[status]}</p>
            </div>
          ),
        )}
      </div>

      <section className="card mt-4 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="section-title">Kehadiran 6 bulan terakhir</h2>
          <span className="muted text-xs">
            {chartRows.length} catatan absensi
          </span>
        </div>
        <p className="muted mb-3 text-xs">
          Batang tiap bulan = jumlah catatan absensi; bagian berwarna adalah
          yang hadir.
        </p>

        {chartRows.length === 0 ? (
          <Empty
            icon="laporan"
            title="Belum ada data 6 bulan terakhir"
            description="Grafik terisi otomatis begitu siswa tercatat pada sesi ekskul."
          />
        ) : (
          <>
            <div className="flex h-40 items-stretch gap-2">
              {bulanEnamTerakhir().map((bulan) => {
                const bucket = perBulan.get(bulan.kunci);
                const total = bucket?.total ?? 0;
                const tinggi =
                  total === 0 ? 3 : Math.max(10, (total / maksBulan) * 70);
                return (
                  <div
                    key={bulan.kunci}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className="muted text-[0.7rem] tabular-nums">
                      {total || ""}
                    </span>
                    <div
                      className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-md"
                      style={{ height: `${tinggi}%`, background: "var(--surface-2)" }}
                      title={`${bulan.label}: ${total} catatan`}
                    >
                      {(["alpha", "sakit", "izin", "hadir"] as AttendanceStatus[]).map(
                        (status) => {
                          const nilai = bucket?.[status] ?? 0;
                          if (nilai === 0 || total === 0) return null;
                          return (
                            <div
                              key={status}
                              style={{
                                height: `${(nilai / total) * 100}%`,
                                background: STATUS_WARNA[status],
                              }}
                            />
                          );
                        },
                      )}
                    </div>
                    <span className="muted text-[0.7rem]">{bulan.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["hadir", "izin", "sakit", "alpha"] as AttendanceStatus[]).map(
                (status) => (
                  <span key={status} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: STATUS_WARNA[status] }}
                    />
                    {STATUS_LABEL[status]}
                  </span>
                ),
              )}
            </div>
          </>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="section-title">Riwayat absensi</h2>
            <span className="muted text-xs">{attendance.length} data</span>
          </div>
          {attendance.length === 0 ? (
            <Empty
              icon="absen"
              title="Tidak ada absensi pada periode ini"
              description={
                student.status === "lulus"
                  ? "Data absensi mentah siswa lulus dihapus setelah masa retensi."
                  : "Coba pilih periode yang lebih panjang di atas, atau riwayat muncul setelah siswa tercatat di sesi ekskul."
              }
            />
          ) : (
            <ul className="divide-y">
              {attendance.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.ekskul?.nama ?? "Ekskul"}
                    </p>
                    <p className="muted text-xs">
                      {formatTanggalPendek(row.tanggal)}
                      {row.catatan ? ` · ${row.catatan}` : ""}
                    </p>
                  </div>
                  <span className={STATUS_CLASS[row.status]}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="section-title mb-2">Data diri</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="muted">Nama</dt>
                <dd className="truncate font-medium">{student.nama}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="muted">NIS</dt>
                <dd className="tabular-nums">{student.nis ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="muted">Kelas</dt>
                <dd>
                  {student.kelas_id
                    ? (kelasMap.get(student.kelas_id)?.label ?? "-")
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="muted">Status</dt>
                <dd className="font-semibold">
                  {student.status === "aktif"
                    ? "Aktif"
                    : student.status === "lulus"
                      ? "Lulus"
                      : "Keluar"}
                </dd>
              </div>
              {student.lulus_at ? (
                <div className="flex justify-between gap-2">
                  <dt className="muted">Tgl lulus</dt>
                  <dd>{formatTanggalPendek(student.lulus_at)}</dd>
                </div>
              ) : null}
            </dl>
            {student.status === "lulus" ? (
              <p className="muted mt-2 text-xs">
                NIS dikosongkan saat kenaikan kelas tahun ajaran. Data pribadi
                dan absensi dihapus otomatis setelah jadwal penghapusan.
              </p>
            ) : null}
            {isAdmin ? null : (
              <p className="muted mt-2 text-xs">
                Perubahan data siswa dilakukan oleh admin sekolah.
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-2">Rekap per ekskul</h2>
            {rekapEkskul.length === 0 ? (
              <p className="muted text-sm">
                Belum ada absensi pada periode yang dipilih.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {rekapEkskul.map((row) => (
                  <li key={row.nama} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        {row.nama}
                      </span>
                      <span className="badge badge-hadir shrink-0">
                        {row.persen}% hadir
                      </span>
                    </div>
                    <p className="muted mt-0.5 text-xs">
                      {row.sesi} sesi · {row.hadir} hadir · {row.izin} izin ·{" "}
                      {row.sakit} sakit · {row.alpha} alpha
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-2">Keanggotaan ekskul</h2>
            {memberships.length === 0 ? (
              <p className="muted text-sm">Belum pernah menjadi anggota.</p>
            ) : (
              <ul className="divide-y">
                {memberships.map((member) => (
                  <li key={member.id} className="py-2 text-sm">
                    <Link
                      href={
                        member.ekskul
                          ? `/ekskul/${member.ekskul.id}`
                          : "/ekskul"
                      }
                      className="font-medium hover:underline"
                    >
                      {member.ekskul?.nama ?? "Ekskul"}
                    </Link>
                    <p className="muted text-xs">
                      {formatTanggalPendek(member.joined_at)} –{" "}
                      {member.left_at
                        ? formatTanggalPendek(member.left_at)
                        : "sekarang"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
