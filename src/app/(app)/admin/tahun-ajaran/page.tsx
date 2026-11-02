import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  activateTahunAjaranAction,
  rolloverAction,
  saveTahunAjaranAction,
} from "@/lib/actions/admin";
import { formatTanggalPendek } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

interface TahunRow {
  id: string;
  nama: string;
  mulai: string;
  selesai: string;
  is_active: boolean;
}

export default async function TahunAjaranPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("tahun_ajaran")
    .select("id,nama,mulai,selesai,is_active")
    .order("mulai", { ascending: false });

  const rows = (data ?? []) as TahunRow[];
  const active = rows.find((row) => row.is_active) ?? null;

  return (
    <div>
      <PageHeader
        title="Tahun Ajaran"
        description="Atur tahun ajaran aktif untuk kelas, impor siswa, dan sinkronisasi Sheets."
      />

      <Flash ok={params.ok} error={params.error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="section-title mb-3">Buat tahun ajaran baru</h2>
          <form action={saveTahunAjaranAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="nama">
                Nama tahun ajaran
              </label>
              <input
                id="nama"
                name="nama"
                className="input"
                placeholder="2026/2027"
                required
                maxLength={20}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="mulai">
                  Mulai
                </label>
                <input
                  id="mulai"
                  type="date"
                  name="mulai"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="selesai">
                  Selesai
                </label>
                <input
                  id="selesai"
                  type="date"
                  name="selesai"
                  className="input"
                  required
                />
              </div>
            </div>
            <SubmitButton className="btn btn-primary">
              Simpan
            </SubmitButton>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-2">Rollover ke tahun ajaran baru</h2>
          <p className="muted mb-3 text-xs">
            Siswa kelas 10/11 naik kelas tanpa pindah jurusan. Siswa kelas 12 jadi
            lulus, NIS di-null-kan, data pribadi+absensi akan dihapus 3 bulan
            setelah lulus (atur di Pengaturan).
          </p>

          {active ? (
            <form action={rolloverAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="roll-nama">
                  Nama tahun ajaran baru
                </label>
                <input
                  id="roll-nama"
                  name="nama"
                  className="input"
                  placeholder="2027/2028"
                  required
                  maxLength={20}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="roll-mulai">
                    Mulai
                  </label>
                  <input
                    id="roll-mulai"
                    type="date"
                    name="mulai"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="roll-selesai">
                    Selesai
                  </label>
                  <input
                    id="roll-selesai"
                    type="date"
                    name="selesai"
                    className="input"
                    required
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="salin"
                  value="1"
                  defaultChecked
                  className="accent-[var(--accent)]"
                />
                Salin anggota ekskul aktif ke tahun ajaran baru
              </label>
              <SubmitButton className="btn btn-primary">
                Jalankan rollover
              </SubmitButton>
            </form>
          ) : (
            <p className="muted text-sm">
              Belum ada tahun ajaran aktif. Buat dan aktifkan terlebih dahulu.
            </p>
          )}
        </section>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="section-title mb-3">Daftar tahun ajaran</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Periode</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted text-center">
                    Belum ada data
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.nama}</td>
                    <td className="muted text-sm">
                      {formatTanggalPendek(row.mulai)} –{" "}
                      {formatTanggalPendek(row.selesai)}
                    </td>
                    <td>
                      {row.is_active ? (
                        <span className="badge badge-hadir">Aktif</span>
                      ) : (
                        <span className="badge badge-muted">Tidak aktif</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!row.is_active ? (
                        <form action={activateTahunAjaranAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            Aktifkan
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
