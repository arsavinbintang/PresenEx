import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Icon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveJurusanAction } from "@/lib/actions/admin";
import { romanTingkat } from "@/lib/utils/tanggal";
import type { Jurusan } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function JurusanPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("jurusan")
    .select("id,kode,nama,kelas_per_tingkat,is_active,created_at")
    .order("kode");

  const jurusan = (data ?? []) as Jurusan[];

  return (
    <div>
      <PageHeader
        title="Jurusan"
        description="Kode jurusan dipakai untuk menyusun nama kelas, misalnya X RPL 1."
      />

      <Flash ok={params.ok} error={params.error} />

      <section className="card mb-4 p-4">
        <h2 className="section-title mb-3">Tambah jurusan</h2>
        <form
          action={saveJurusanAction}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="label" htmlFor="kode">
              Kode
            </label>
            <input
              id="kode"
              name="kode"
              className="input"
              placeholder="RPL"
              maxLength={10}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="nama">
              Nama jurusan
            </label>
            <input
              id="nama"
              name="nama"
              className="input"
              placeholder="Rekayasa Perangkat Lunak"
              maxLength={80}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="kelas_per_tingkat">
              Kelas / tingkat
            </label>
            <input
              id="kelas_per_tingkat"
              name="kelas_per_tingkat"
              type="number"
              min={1}
              max={20}
              defaultValue={3}
              className="input"
              required
            />
          </div>
          <input type="hidden" name="is_active" value="1" />
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton className="btn btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              Simpan jurusan
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="space-y-2">
        {jurusan.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-semibold">Belum ada jurusan</p>
            <p className="muted mt-1 text-sm">
              Tambahkan jurusan sebelum membuat kelas dan mengimpor siswa.
            </p>
          </div>
        ) : (
          jurusan.map((item) => (
            <details key={item.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="badge badge-muted">{item.kode}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {item.nama}
                </span>
                <span className="muted text-xs">
                  {item.kelas_per_tingkat} kelas / tingkat
                </span>
                <span
                  className={
                    item.is_active ? "badge badge-hadir" : "badge badge-muted"
                  }
                >
                  {item.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <Icon
                  name="edit"
                  className="h-4 w-4 shrink-0 text-[var(--muted)]"
                />
              </summary>

              <form
                action={saveJurusanAction}
                className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input type="hidden" name="id" value={item.id} />
                <div>
                  <label className="label">Kode</label>
                  <input
                    name="kode"
                    className="input"
                    defaultValue={item.kode}
                    maxLength={10}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Nama jurusan</label>
                  <input
                    name="nama"
                    className="input"
                    defaultValue={item.nama}
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <label className="label">Kelas / tingkat</label>
                  <input
                    name="kelas_per_tingkat"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={item.kelas_per_tingkat}
                    className="input"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    value="1"
                    defaultChecked={item.is_active}
                    className="accent-[var(--accent)]"
                  />
                  Aktif (dipakai saat membuat kelas baru)
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <SubmitButton className="btn btn-primary btn-sm">
                    Simpan perubahan
                  </SubmitButton>
                </div>
              </form>

              <p className="muted mt-3 text-xs">
                Kelas yang dibuat:{" "}
                {[10, 11, 12]
                  .map((tingkat) => `${romanTingkat(tingkat)} ${item.kode} 1–${item.kelas_per_tingkat}`)
                  .join(", ")}
              </p>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
