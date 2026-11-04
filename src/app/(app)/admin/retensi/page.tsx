import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Empty } from "@/components/ui/empty";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  purgeNowAction,
  togglePurgeHoldAction,
} from "@/lib/actions/admin";
import { addMonths, formatTanggalPendek, todayISO } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

interface LulusRow {
  id: string;
  nama: string;
  nis: string | null;
  lulus_at: string | null;
  purge_hold: boolean;
}

interface PurgeLog {
  id: number;
  jumlah_siswa: number;
  dijalankan_oleh: string;
  created_at: string;
}

export default async function RetensiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const settings = await getAppSettings();
  const today = todayISO(settings?.timezone ?? "Asia/Jakarta");
  const cutoff = addMonths(today, -(settings?.purge_after_months ?? 3));

  const [studentsRes, logsRes] = await Promise.all([
    supabase
      .from("students")
      .select("id,nama,nis,lulus_at,purge_hold")
      .eq("status", "lulus")
      .order("lulus_at"),
    supabase
      .from("purge_log")
      .select("id,jumlah_siswa,dijalankan_oleh,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const students = (studentsRes.data ?? []) as LulusRow[];
  const logs = (logsRes.data ?? []) as PurgeLog[];
  const siap = students.filter(
    (student) =>
      !student.purge_hold && student.lulus_at !== null && student.lulus_at <= cutoff,
  );

  return (
    <div>
      <PageHeader
        title="Retensi"
        description={`Hapus data siswa lulus ${settings?.purge_after_months ?? 3} bulan setelah lulus`}
        action={
          <Link href="/admin/pengaturan" className="btn btn-ghost btn-sm">
            Ubah masa retensi
          </Link>
        }
      />

      <Flash ok={params.ok} error={params.error} />

      <section className="card mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Siswa lulus</h2>
            <p className="muted mt-1 text-xs">
              {students.length} siswa lulus · batas hapus saat ini{" "}
              {formatTanggalPendek(cutoff)} · {siap.length} siap dihapus.
            </p>
          </div>
          <form action={purgeNowAction}>
            <ConfirmSubmit
              className="btn btn-danger btn-sm"
              message={`Hapus permanen ${siap.length} siswa lulus beserta data absensinya? Tindakan ini tidak bisa dibatalkan.`}
            >
              Hapus sekarang
            </ConfirmSubmit>
          </form>
        </div>

        <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-xs">
          <p className="font-semibold">Yang dihapus</p>
          <p className="muted mt-0.5">
            Data pribadi siswa, keanggotaan ekskul, absensi mentah, dan audit
            perubahan. Ringkasan harian (attendance_daily) tetap disimpan untuk
            statistik sekolah.
          </p>
        </div>
      </section>

      {students.length === 0 ? (
        <div className="card">
          <Empty
            icon="archive"
            title="Belum ada siswa lulus"
            description="Siswa akan masuk ke sini setelah rollover tahun ajaran."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Lulus</th>
                  <th>Status hapus</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const due =
                    student.lulus_at !== null && student.lulus_at <= cutoff;
                  return (
                    <tr key={student.id}>
                      <td>
                        <p className="font-medium">{student.nama}</p>
                        <p className="muted text-xs">
                          NIS {student.nis ?? "sudah dikosongkan"}
                        </p>
                      </td>
                      <td className="muted text-sm">
                        {student.lulus_at
                          ? formatTanggalPendek(student.lulus_at)
                          : "-"}
                      </td>
                      <td>
                        {student.purge_hold ? (
                          <span className="badge badge-sakit">Ditahan</span>
                        ) : due ? (
                          <span className="badge badge-alpha">Siap hapus</span>
                        ) : (
                          <span className="badge badge-muted">Menunggu</span>
                        )}
                      </td>
                      <td className="text-right">
                        <form action={togglePurgeHoldAction}>
                          <input type="hidden" name="id" value={student.id} />
                          <input
                            type="hidden"
                            name="hold"
                            value={student.purge_hold ? "0" : "1"}
                          />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            {student.purge_hold ? "Lepas tahan" : "Tahan"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="card mt-4 p-4">
        <h2 className="section-title mb-3">Riwayat penghapusan</h2>
        {logs.length === 0 ? (
          <p className="muted text-sm">Belum ada penghapusan.</p>
        ) : (
          <ul className="divide-y text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{log.jumlah_siswa} siswa</span>
                  <span className="muted"> · {log.dijalankan_oleh}</span>
                </span>
                <span className="muted text-xs">
                  {new Date(log.created_at).toLocaleString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
