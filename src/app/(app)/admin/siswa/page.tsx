import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveTA,
  getKelasMap,
  listKelasOptions,
} from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImportSiswaForm } from "@/components/admin/import-siswa-form";
import { saveSiswaAction } from "@/lib/actions/admin";
import type { Student } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function sanitizeQuery(value: string): string {
  return value.replace(/[,()%*\\]/g, " ").trim();
}

export default async function SiswaPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    q?: string;
    page?: string;
    edit?: string;
  }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const q = sanitizeQuery(params.q ?? "");
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const activeTA = await getActiveTA(supabase);
  const [kelasOptions, kelasMap, editRes] = await Promise.all([
    listKelasOptions(supabase, activeTA?.id ?? null),
    getKelasMap(supabase),
    params.edit
      ? supabase
          .from("students")
          .select("*")
          .eq("id", params.edit)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const editStudent = (editRes.data as Student | null) ?? null;

  let query = supabase
    .from("students")
    .select("id,nama,nis,kelas_id,status,created_at", { count: "exact" })
    .eq("status", "aktif")
    .order("nama")
    .range(from, from + PAGE_SIZE - 1);

  if (q) {
    query = query.or(`nama.ilike.%${q}%,nis.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  const students = (data ?? []) as Array<
    Pick<Student, "id" | "nama" | "nis" | "kelas_id" | "status">
  >;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (nextPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (nextPage > 1) sp.set("page", String(nextPage));
    return `/admin/siswa${sp.size ? `?${sp.toString()}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Siswa"
        description={`${total} siswa aktif${activeTA ? ` · TA ${activeTA.nama}` : ""}`}
        action={
          <a href="#tambah" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-4 w-4" />
            Tambah
          </a>
        }
      />

      <Flash ok={params.ok} error={params.error} />

      <div className="card mb-4 p-3">
        <form method="get" className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              name="q"
              defaultValue={q}
              className="input pl-9"
              placeholder="Cari nama atau NIS"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-ghost">
            Cari
          </button>
          {q ? (
            <Link href="/admin/siswa" className="btn btn-ghost">
              Reset
            </Link>
          ) : null}
        </form>
      </div>

      {error ? (
        <div className="card mb-4 p-4 text-sm text-[var(--alpha)]">
          Gagal memuat siswa: {error.message}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="card">
          <Empty
            icon="users"
            title={q ? "Siswa tidak ditemukan" : "Belum ada siswa"}
            description={
              q
                ? "Coba kata kunci lain atau reset pencarian."
                : "Tambahkan satu per satu atau impor lewat CSV."
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NIS</th>
                  <th className="hidden sm:table-cell">Kelas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <Link
                        href={`/siswa/${student.id}`}
                        className="font-medium hover:underline"
                      >
                        {student.nama}
                      </Link>
                      <p className="muted text-xs sm:hidden">
                        {student.kelas_id
                          ? (kelasMap.get(student.kelas_id)?.label ?? "-")
                          : "-"}
                      </p>
                    </td>
                    <td className="muted text-xs tabular-nums">
                      {student.nis ?? "-"}
                    </td>
                    <td className="hidden sm:table-cell">
                      {student.kelas_id
                        ? (kelasMap.get(student.kelas_id)?.label ?? "-")
                        : "-"}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/siswa?edit=${student.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                        className="btn btn-ghost btn-sm !px-2"
                        title="Ubah data"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
              <span className="muted text-xs">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={buildHref(page - 1)} className="btn btn-ghost btn-sm">
                    Sebelumnya
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={buildHref(page + 1)} className="btn btn-ghost btn-sm">
                    Berikutnya
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section id="tambah" className="card scroll-mt-20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">
              {editStudent ? "Ubah data siswa" : "Tambah siswa"}
            </h2>
            {editStudent ? (
              <Link
                href="/admin/siswa"
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Batal
              </Link>
            ) : null}
          </div>

          <form action={saveSiswaAction} className="space-y-3">
            {editStudent ? (
              <input type="hidden" name="id" value={editStudent.id} />
            ) : null}

            <div>
              <label className="label" htmlFor="nama">
                Nama lengkap
              </label>
              <input
                id="nama"
                name="nama"
                className="input"
                defaultValue={editStudent?.nama ?? ""}
                required
                maxLength={100}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="nis">
                  NIS (opsional)
                </label>
                <input
                  id="nis"
                  name="nis"
                  className="input"
                  defaultValue={editStudent?.nis ?? ""}
                  maxLength={30}
                  placeholder="Unik untuk siswa aktif"
                />
              </div>
              <div>
                <label className="label" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={editStudent?.status ?? "aktif"}
                  className="select"
                >
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="keluar">Keluar</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="kelas_id">
                Kelas
              </label>
              <select
                id="kelas_id"
                name="kelas_id"
                defaultValue={editStudent?.kelas_id ?? ""}
                className="select"
              >
                <option value="">Tanpa kelas</option>
                {kelasOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {kelasOptions.length === 0 ? (
                <p className="muted mt-1 text-xs">
                  Belum ada kelas. Buat lewat menu Kelas.
                </p>
              ) : null}
            </div>

            <SubmitButton className="btn btn-primary w-full sm:w-auto">
              {editStudent ? "Simpan perubahan" : "Tambah siswa"}
            </SubmitButton>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">Impor CSV</h2>
          {activeTA ? (
            <ImportSiswaForm tahunAjaranId={activeTA.id} />
          ) : (
            <p className="muted text-sm">
              Buat tahun ajaran aktif dan generate kelas sebelum mengimpor.
            </p>
          )}
        </section>
      </div>

      <p className="muted mt-4 text-xs">
        NIS harus unik di antara siswa aktif. Jika NIS kosong, kombinasi
        kelas + nama dipakai sebagai pembeda.
      </p>
    </div>
  );
}
