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

export default async function SiswaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [kelasMap, membersRes, attendanceRes] = await Promise.all([
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
      .order("tanggal", { ascending: false })
      .limit(100),
  ]);

  const memberships = (membersRes.data ?? []) as unknown as Array<{
    id: string;
    joined_at: string;
    left_at: string | null;
    ekskul: { id: string; nama: string } | null;
  }>;

  const attendance = (attendanceRes.data ?? []) as unknown as Array<{
    id: string;
    tanggal: string;
    status: AttendanceStatus;
    catatan: string | null;
    ekskul: { nama: string } | null;
  }>;

  const counts = attendance.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { hadir: 0, izin: 0, sakit: 0, alpha: 0 } as Record<AttendanceStatus, number>,
  );

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
        description={`${student.kelas_id ? (kelasMap.get(student.kelas_id)?.label ?? "-") : "Tanpa kelas"} · ${student.nis ? `NIS ${student.nis}` : "Tanpa NIS"}`}
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="section-title mb-3">Riwayat absensi terakhir</h2>
          {attendance.length === 0 ? (
            <Empty
              icon="absen"
              title="Belum ada absensi"
              description={
                student.status === "lulus"
                  ? "Data absensi mentah siswa lulus dihapus setelah masa retensi."
                  : "Riwayat muncul setelah siswa tercatat di sesi ekskul."
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
            <h2 className="section-title mb-2">Status siswa</h2>
            <p className="text-sm">
              <span className="muted">Status: </span>
              <span className="font-semibold">{student.status}</span>
            </p>
            {student.lulus_at ? (
              <p className="mt-1 text-sm">
                <span className="muted">Lulus: </span>
                {formatTanggalPendek(student.lulus_at)}
              </p>
            ) : null}
            {student.status === "lulus" ? (
              <p className="muted mt-2 text-xs">
                NIS dikosongkan saat rollover. Data pribadi dan absensi dihapus
                otomatis setelah masa retensi.
              </p>
            ) : null}
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
