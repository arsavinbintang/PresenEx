import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Icon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  deleteJurusanAction,
  saveJurusanAction,
} from "@/lib/actions/admin";
import { romanTingkat } from "@/lib/utils/tanggal";
import type { Jurusan } from "@/types/db";

export const dynamic = "force-dynamic";

const TINGKAT: Array<{ nilai: 10 | 11 | 12; label: string }> = [
  { nilai: 10, label: "Kelas X (tingkat 10)" },
  { nilai: 11, label: "Kelas XI (tingkat 11)" },
  { nilai: 12, label: "Kelas XII (tingkat 12)" },
];

function jumlah(item: Jurusan, tingkat: 10 | 11 | 12): number {
  if (tingkat === 10) return item.jumlah_kelas_10;
  if (tingkat === 11) return item.jumlah_kelas_11;
  return item.jumlah_kelas_12;
}

/** Contoh nama kelas: "X RPL 1–2", "XII RPL 1–3"; 0 = tanpa kelas. */
function contohKelas(item: Pick<Jurusan, "kode">, tingkat: 10 | 11 | 12, n: number) {
  if (n <= 0) return `${romanTingkat(tingkat)} ${item.kode} tanpa kelas`;
  return n === 1
    ? `${romanTingkat(tingkat)} ${item.kode} 1`
    : `${romanTingkat(tingkat)} ${item.kode} 1–${n}`;
}

function FieldJumlah({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        min={0}
        max={20}
        defaultValue={defaultValue}
        className="input"
        required
      />
      <p className="muted mt-1 text-xs">0 = tingkat ini tanpa kelas</p>
    </div>
  );
}

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
    .select(
      "id,kode,nama,jumlah_kelas_10,jumlah_kelas_11,jumlah_kelas_12,is_active,created_at",
    )
    .order("kode");

  const jurusan = (data ?? []) as Jurusan[];

  return (
    <div>
      <PageHeader
        title="Jurusan"
        description="Kode jurusan dipakai untuk menyusun nama kelas, misalnya X RPL 1. Jumlah kelas boleh berbeda tiap tingkat."
      />

      <Flash ok={params.ok} error={params.error} />

      <section className="card mb-4 p-4">
        <h2 className="section-title mb-1">Tambah jurusan</h2>
        <p className="muted mb-3 text-xs">
          Isi jumlah rombongan kelas untuk masing-masing tingkat. Contoh: X 2,
          XI 2, XII 3.
        </p>
        <form
          action={saveJurusanAction}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
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
          <div className="sm:col-span-1">
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
          <input type="hidden" name="is_active" value="1" />
          {TINGKAT.map((t) => (
            <FieldJumlah
              key={t.nilai}
              id={`jumlah_kelas_${t.nilai}`}
              name={`jumlah_kelas_${t.nilai}`}
              label={t.label}
              defaultValue={3}
            />
          ))}
          <div className="sm:col-span-2 lg:col-span-3">
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
                  X {item.jumlah_kelas_10} · XI {item.jumlah_kelas_11} · XII{" "}
                  {item.jumlah_kelas_12} kelas
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
                className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3"
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
                <div>
                  <label className="label">Nama jurusan</label>
                  <input
                    name="nama"
                    className="input"
                    defaultValue={item.nama}
                    maxLength={80}
                    required
                  />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    value="1"
                    defaultChecked={item.is_active}
                    className="accent-[var(--accent)]"
                  />
                  Aktif (dipakai saat membuat kelas baru)
                </label>
                {TINGKAT.map((t) => (
                  <FieldJumlah
                    key={t.nilai}
                    id={`edit_jumlah_kelas_${t.nilai}`}
                    name={`jumlah_kelas_${t.nilai}`}
                    label={t.label}
                    defaultValue={jumlah(item, t.nilai)}
                  />
                ))}
                <div className="sm:col-span-2 lg:col-span-3">
                  <SubmitButton className="btn btn-primary btn-sm">
                    Simpan perubahan
                  </SubmitButton>
                </div>
              </form>

              <p className="muted mt-3 text-xs">
                Kelas yang dibuat:{" "}
                {TINGKAT.map((t) =>
                  contohKelas(item, t.nilai, jumlah(item, t.nilai)),
                ).join(", ")}
              </p>

              <form action={deleteJurusanAction} className="mt-3 border-t pt-3">
                <input type="hidden" name="id" value={item.id} />
                <ConfirmSubmit
                  className="btn btn-danger btn-sm"
                  message={`Hapus jurusan ${item.kode}? Jurusan hanya bisa dihapus bila belum ada siswa di kelasnya.`}
                >
                  <Icon name="trash" className="h-4 w-4" />
                  Hapus jurusan
                </ConfirmSubmit>
              </form>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
