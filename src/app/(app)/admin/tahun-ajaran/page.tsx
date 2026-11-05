import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { ActionModal } from "@/components/ui/action-modal";
import { Icon } from "@/components/ui/icons";
import {
  activateTahunAjaranAction,
  deleteTahunAjaranAction,
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

const LANGKAH = [
  {
    nomor: "1",
    judul: "Buat tahun ajaran",
    isi: "Tentukan nama (misal 2026/2027) beserta tanggal mulai dan selesai. Tahun ajaran pertama otomatis menjadi aktif.",
  },
  {
    nomor: "2",
    judul: "Generate kelas",
    isi: "Setelah tahun ajaran aktif, buka menu Kelas lalu tekan Generate. Kelas 10/11/12 untuk seluruh jurusan dibuat otomatis.",
  },
  {
    nomor: "3",
    judul: "Masukkan siswa",
    isi: "Tambah siswa satu per satu atau impor CSV. Siswa selalu terikat ke kelas di tahun ajaran yang sedang aktif.",
  },
  {
    nomor: "4",
    judul: "Naik kelas saat tahun berganti",
    isi: "Tekan Jalankan naik kelas: kelas 10 naik ke 11, kelas 11 naik ke 12, kelas 12 lulus (NIS dikosongkan). Tahun ajaran baru otomatis aktif.",
  },
  {
    nomor: "5",
    judul: "Nonaktifkan / hapus",
    isi: "Tahun ajaran lama otomatis tidak aktif setelah rollover. Tahun ajaran lama yang sudah tidak berisi siswa aktif bisa dihapus.",
  },
];

function TahunAjaranForm({
  id,
  defaultNama,
  defaultMulai,
  defaultSelesai,
  submitLabel,
}: {
  id?: string;
  defaultNama?: string;
  defaultMulai?: string;
  defaultSelesai?: string;
  submitLabel: string;
}) {
  return (
    <form action={saveTahunAjaranAction} className="space-y-3">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <div>
        <label className="label" htmlFor={`nama-${id ?? "baru"}`}>
          Nama tahun ajaran
        </label>
        <input
          id={`nama-${id ?? "baru"}`}
          name="nama"
          className="input"
          placeholder="2026/2027"
          defaultValue={defaultNama ?? ""}
          required
          maxLength={20}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`mulai-${id ?? "baru"}`}>
            Mulai
          </label>
          <input
            id={`mulai-${id ?? "baru"}`}
            type="date"
            name="mulai"
            className="input"
            defaultValue={defaultMulai ?? ""}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`selesai-${id ?? "baru"}`}>
            Selesai
          </label>
          <input
            id={`selesai-${id ?? "baru"}`}
            type="date"
            name="selesai"
            className="input"
            defaultValue={defaultSelesai ?? ""}
            required
          />
        </div>
      </div>
      <SubmitButton className="btn btn-primary">{submitLabel}</SubmitButton>
    </form>
  );
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
  const inactiveCount = rows.filter((row) => !row.is_active).length;

  return (
    <div>
      <PageHeader
        title="Tahun Ajaran"
        description="Wadah kelas, siswa, dan absensi. Satu waktu hanya satu tahun ajaran yang aktif."
        action={
          <ActionModal
            title="Tambah tahun ajaran"
            hint="Tahun ajaran pertama otomatis menjadi aktif."
          >
            <TahunAjaranForm submitLabel="Simpan tahun ajaran" />
          </ActionModal>
        }
      />

      <Flash ok={params.ok} error={params.error} />

      <section className="card mb-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          <h2 className="section-title !mb-0">
            Apa gunanya tahun ajaran?
          </h2>
        </div>

        <p className="muted mb-3 text-sm">
          Tahun ajaran adalah periode yang menampung seluruh kelas, siswa, dan
          data absensi. Dengan adanya periode, data tahun lalu tidak tercampur
          dengan tahun baru, dan kenaikan kelas bisa dijalankan sekali tekan.
          Periode yang sedang{" "}
          <strong className="text-[var(--foreground)]">aktif</strong> adalah
          periode tempat data baru ditambahkan.
        </p>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LANGKAH.map((langkah) => (
            <li
              key={langkah.nomor}
              className="rounded-xl border bg-[var(--surface-2)] p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                  }}
                >
                  {langkah.nomor}
                </span>
                <p className="text-sm font-semibold">{langkah.judul}</p>
              </div>
              <p className="muted mt-1.5 text-xs leading-relaxed">
                {langkah.isi}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="badge badge-muted">
            Total {rows.length} tahun ajaran
          </span>
          {active ? (
            <span className="badge badge-hadir">Aktif: {active.nama}</span>
          ) : (
            <span className="badge badge-alpha">Belum ada yang aktif</span>
          )}
          {inactiveCount > 0 ? (
            <span className="badge badge-muted">{inactiveCount} nonaktif</span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="section-title mb-2">
            Naik kelas ke tahun ajaran baru
          </h2>
          <p className="muted mb-3 text-xs">
            Siswa kelas 10 naik ke 11, kelas 11 naik ke 12 (jurusan tetap sama),
            dan siswa kelas 12 ditandai lulus dengan NIS dikosongkan. Data
            pribadi siswa lulus beserta absensinya dihapus otomatis beberapa
            bulan setelah lulus (atur di menu Hapus data lulus). Rekap absensi
            harian tetap disimpan.
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
              <ConfirmSubmit
                className="btn btn-primary"
                message="Lanjutkan naik kelas? Siswa kelas 12 akan ditandai lulus dan tahun ajaran baru menjadi aktif. Tindakan ini tidak bisa dibatalkan."
              >
                Jalankan naik kelas
              </ConfirmSubmit>
            </form>
          ) : (
            <p className="muted text-sm">
              Belum ada tahun ajaran aktif. Buat dan aktifkan terlebih dahulu.
            </p>
          )}
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="section-title !mb-0">Daftar tahun ajaran</h2>
            <ActionModal
              label="Tambah"
              title="Tambah tahun ajaran"
              hint="Nama, tanggal mulai, dan selesai."
            >
              <TahunAjaranForm submitLabel="Simpan tahun ajaran" />
            </ActionModal>
          </div>

          <div className="table-wrap">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th className="hidden sm:table-cell">Periode</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
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
                      <td className="font-medium">
                        {row.nama}
                        <p className="muted text-xs sm:hidden">
                          {formatTanggalPendek(row.mulai)} –{" "}
                          {formatTanggalPendek(row.selesai)}
                        </p>
                      </td>
                      <td
                        className="muted hidden text-sm sm:table-cell"
                        data-label="Periode"
                      >
                        {formatTanggalPendek(row.mulai)} –{" "}
                        {formatTanggalPendek(row.selesai)}
                      </td>
                      <td data-label="Status">
                        {row.is_active ? (
                          <span className="badge badge-hadir">Aktif</span>
                        ) : (
                          <span className="badge badge-muted">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <ActionModal
                            label="Ubah"
                            title={`Ubah ${row.nama}`}
                            hint="Nama dan periode tahun ajaran."
                            icon="edit"
                            className="btn btn-ghost btn-sm"
                          >
                            <TahunAjaranForm
                              id={row.id}
                              defaultNama={row.nama}
                              defaultMulai={row.mulai}
                              defaultSelesai={row.selesai}
                              submitLabel="Simpan perubahan"
                            />
                          </ActionModal>

                          {!row.is_active ? (
                            <form action={activateTahunAjaranAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-sm"
                              >
                                Aktifkan
                              </button>
                            </form>
                          ) : null}

                          {!row.is_active ? (
                            <form action={deleteTahunAjaranAction}>
                              <input type="hidden" name="id" value={row.id} />
                              <ConfirmSubmit
                                className="btn btn-ghost btn-sm !text-[var(--alpha)]"
                                title="Hapus tahun ajaran"
                                message={`Hapus tahun ajaran ${row.nama}? Tahun ajaran hanya bisa dihapus bila tidak aktif dan tidak berisi siswa aktif.`}
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </ConfirmSubmit>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="muted mt-3 text-xs">
            Tahun ajaran aktif tidak bisa dihapus. Aktifkan tahun ajaran lain
            terlebih dahulu. Tahun ajaran yang masih berisi siswa aktif juga
            dilindungi agar data siswa tidak ikut hilang.
          </p>
        </section>
      </div>
    </div>
  );
}
