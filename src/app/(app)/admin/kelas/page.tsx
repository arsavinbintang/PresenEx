import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { Empty } from "@/components/ui/empty";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  addKelasAction,
  generateKelasAction,
} from "@/lib/actions/admin";
import { labelKelas, romanTingkat } from "@/lib/utils/tanggal";
import type { Jurusan, TahunAjaran } from "@/types/db";

export const dynamic = "force-dynamic";

interface KelasRow {
  id: string;
  tahun_ajaran_id: string;
  jurusan_id: string;
  tingkat: number;
  nomor: number;
  jurusan: { kode: string; nama: string } | null;
}

export default async function KelasPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    ta?: string;
  }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const { data: taData } = await supabase
    .from("tahun_ajaran")
    .select("id,nama,mulai,selesai,is_active,created_at")
    .order("mulai", { ascending: false });

  const tahunAjaran = (taData ?? []) as TahunAjaran[];
  const active =
    tahunAjaran.find((ta) => ta.id === params.ta) ??
    tahunAjaran.find((ta) => ta.is_active) ??
    tahunAjaran[0] ??
    null;

  const [jurusanRes, kelasRes, siswaRes] = await Promise.all([
    supabase
      .from("jurusan")
      .select("id,kode,nama,kelas_per_tingkat,is_active")
      .eq("is_active", true)
      .order("kode"),
    active
      ? supabase
          .from("kelas")
          .select(
            "id,tahun_ajaran_id,jurusan_id,tingkat,nomor,jurusan:jurusan_id(kode,nama)",
          )
          .eq("tahun_ajaran_id", active.id)
          .order("tingkat")
          .order("nomor")
      : Promise.resolve({ data: [] }),
    supabase
      .from("students")
      .select("kelas_id")
      .eq("status", "aktif")
      .not("kelas_id", "is", null),
  ]);

  const jurusan = (jurusanRes.data ?? []) as Jurusan[];
  const kelas = (kelasRes.data ?? []) as unknown as KelasRow[];
  const counts = new Map<string, number>();
  for (const row of (siswaRes.data ?? []) as Array<{ kelas_id: string }>) {
    counts.set(row.kelas_id, (counts.get(row.kelas_id) ?? 0) + 1);
  }

  const byTingkat = new Map<number, KelasRow[]>();
  for (const row of kelas) {
    const list = byTingkat.get(row.tingkat) ?? [];
    list.push(row);
    byTingkat.set(row.tingkat, list);
  }

  return (
    <div>
      <PageHeader
        title="Kelas"
        description="Satu tahun ajaran punya daftar kelas sendiri. Rollover membuat kelas baru otomatis."
      />

      <Flash ok={params.ok} error={params.error} />

      {tahunAjaran.length === 0 ? (
        <div className="card">
          <Empty
            icon="calendar"
            title="Belum ada tahun ajaran"
            description="Buat tahun ajaran terlebih dahulu."
            action={
              <Link href="/admin/tahun-ajaran" className="btn btn-primary btn-sm">
                Buka tahun ajaran
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="card mb-4 p-4">
            <form method="get" className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="ta">
                  Tahun ajaran
                </label>
                <select
                  id="ta"
                  name="ta"
                  defaultValue={active?.id ?? ""}
                  className="select"
                >
                  {tahunAjaran.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.nama}
                      {ta.is_active ? " (aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-ghost">
                Tampilkan
              </button>
            </form>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {[10, 11, 12].map((tingkat) => {
                const rows = byTingkat.get(tingkat) ?? [];
                return (
                  <section key={tingkat} className="card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="section-title">Tingkat {romanTingkat(tingkat)}</h2>
                      <span className="badge badge-muted">{rows.length} kelas</span>
                    </div>

                    {rows.length === 0 ? (
                      <p className="muted py-3 text-sm">
                        Belum ada kelas. Jalankan &quot;Generate kelas&quot; atau
                        tambah manual.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {rows.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-lg border px-3 py-2"
                          >
                            <p className="text-sm font-semibold">
                              {labelKelas({
                                tingkat: row.tingkat,
                                jurusan_kode: row.jurusan?.kode ?? "-",
                                nomor: row.nomor,
                              })}
                            </p>
                            <p className="muted text-xs">
                              {counts.get(row.id) ?? 0} siswa
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <div className="space-y-4">
              <section className="card p-4">
                <h2 className="section-title mb-2">Generate kelas</h2>
                <p className="muted mb-3 text-xs">
                  Membuat semua kombinasi jurusan × tingkat × nomor untuk tahun
                  ajaran {active?.nama}. Kelas yang sudah ada tidak diduplikasi.
                </p>
                <form action={generateKelasAction}>
                  <input
                    type="hidden"
                    name="tahun_ajaran_id"
                    value={active?.id ?? ""}
                  />
                  <ConfirmSubmit
                    className="btn btn-primary w-full"
                    message={`Generate kelas untuk ${active?.nama}? Kelas yang sudah ada akan dilewati.`}
                  >
                    Generate kelas
                  </ConfirmSubmit>
                </form>
              </section>

              <section className="card p-4">
                <h2 className="section-title mb-3">Tambah satu kelas</h2>
                <form action={addKelasAction} className="space-y-3">
                  <input
                    type="hidden"
                    name="tahun_ajaran_id"
                    value={active?.id ?? ""}
                  />
                  <div>
                    <label className="label" htmlFor="jurusan_id">
                      Jurusan
                    </label>
                    <select
                      id="jurusan_id"
                      name="jurusan_id"
                      className="select"
                      required
                    >
                      <option value="">Pilih jurusan</option>
                      {jurusan.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.kode} — {item.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label" htmlFor="tingkat">
                        Tingkat
                      </label>
                      <select
                        id="tingkat"
                        name="tingkat"
                        className="select"
                        required
                      >
                        <option value="10">X</option>
                        <option value="11">XI</option>
                        <option value="12">XII</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="nomor">
                        Nomor
                      </label>
                      <input
                        id="nomor"
                        name="nomor"
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={1}
                        className="input"
                        required
                      />
                    </div>
                  </div>
                  <SubmitButton className="btn btn-primary w-full">
                    Tambah kelas
                  </SubmitButton>
                </form>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
