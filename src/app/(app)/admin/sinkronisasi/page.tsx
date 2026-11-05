import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleEnv } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  deleteSheetConfigAction,
  retrySyncAction,
  saveSheetConfigAction,
} from "@/lib/actions/admin";
import {
  formatTanggalLengkapPendek,
  formatTanggalPendek,
} from "@/lib/utils/tanggal";
import type { TahunAjaran } from "@/types/db";

export const dynamic = "force-dynamic";

interface ConfigRow {
  id: string;
  tahun_ajaran_id: string;
  spreadsheet_id: string;
  is_active: boolean;
  tahun_ajaran: { nama: string } | null;
}

interface JobRow {
  id: number;
  ekskul_id: string;
  tanggal: string;
  action: "upsert" | "delete";
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  run_after: string;
  ekskul: { nama: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  processing: "Diproses",
  done: "Selesai",
  failed: "Gagal",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "badge badge-sakit",
  processing: "badge badge-izin",
  done: "badge badge-hadir",
  failed: "badge badge-alpha",
};

export default async function SinkronisasiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const googleReady = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );

  const [configRes, taRes, jobsRes, pendingRes, failedRes] = await Promise.all([
    supabase
      .from("sheet_config")
      .select(
        "id,tahun_ajaran_id,spreadsheet_id,is_active,tahun_ajaran:tahun_ajaran_id(nama)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tahun_ajaran")
      .select("id,nama,mulai,selesai,is_active,created_at")
      .order("mulai", { ascending: false }),
    supabase
      .from("sheet_sync_jobs")
      .select(
        "id,ekskul_id,tanggal,action,status,attempts,last_error,run_after,ekskul:ekskul_id(nama)",
      )
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("sheet_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("sheet_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  const configs = (configRes.data ?? []) as unknown as ConfigRow[];
  const tahunAjaran = (taRes.data ?? []) as TahunAjaran[];
  const jobs = (jobsRes.data ?? []) as unknown as JobRow[];
  const activeConfig = configs.find((config) => config.is_active) ?? null;

  return (
    <div>
      <PageHeader
        title="Sinkronisasi Sheets"
        description="Setiap absensi disalin ke Google Sheets. Kegagalan Sheets tidak membatalkan absensi."
        action={
          <form action={retrySyncAction}>
            <button type="submit" className="btn btn-ghost btn-sm">
              <Icon name="sync" className="h-4 w-4" />
              Proses antrean
            </button>
          </form>
        }
      />

      <Flash ok={params.ok} error={params.error} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="muted text-xs font-semibold uppercase">Menunggu</p>
          <p className="text-2xl font-bold tabular-nums">
            {pendingRes.count ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs font-semibold uppercase">Gagal</p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "var(--alpha)" }}
          >
            {failedRes.count ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs font-semibold uppercase">Spreadsheet aktif</p>
          <p className="mt-1 truncate text-sm font-semibold">
            {activeConfig?.tahun_ajaran?.nama ?? "Belum ada"}
          </p>
        </div>
      </div>

      {!hasServiceRoleEnv() || !googleReady ? (
        <div className="card mb-4 p-4 text-sm">
          <p className="font-semibold">Konfigurasi belum lengkap</p>
          <ul className="muted mt-1 list-inside list-disc space-y-0.5 text-xs">
            {!hasServiceRoleEnv() ? (
              <li>
                <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                belum diisi — dibutuhkan untuk memproses antrean dan membuat akun.
              </li>
            ) : null}
            {!googleReady ? (
              <li>
                <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>{" "}
                dan <code className="font-mono">GOOGLE_PRIVATE_KEY</code> belum
                diisi.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="section-title mb-3">Spreadsheet per tahun ajaran</h2>

          {configs.length === 0 ? (
            <Empty
              icon="sheet"
              title="Belum ada spreadsheet"
              description="Tambahkan konfigurasi di samping. Satu spreadsheet dipakai untuk satu tahun ajaran."
            />
          ) : (
            <ul className="divide-y">
              {configs.map((config) => (
                <li
                  key={config.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {config.tahun_ajaran?.nama ?? "Tahun ajaran"}
                    </p>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${config.spreadsheet_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="muted block truncate font-mono text-xs hover:underline"
                    >
                      {config.spreadsheet_id}
                    </a>
                  </div>
                  {config.is_active ? (
                    <span className="badge badge-hadir">Aktif</span>
                  ) : (
                    <span className="badge badge-muted">Cadangan</span>
                  )}
                  <form action={deleteSheetConfigAction}>
                    <input type="hidden" name="id" value={config.id} />
                    <ConfirmSubmit
                      className="btn btn-ghost btn-sm !px-2"
                      title="Hapus konfigurasi"
                      message={`Hapus Spreadsheet untuk ${config.tahun_ajaran?.nama ?? "tahun ajaran ini"}? Absensi berikutnya tidak akan tersinkron sampai konfigurasi baru dibuat.`}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">
              Tambah / ubah konfigurasi
            </h3>
            <form
              action={saveSheetConfigAction}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div>
                <label className="label" htmlFor="tahun_ajaran_id">
                  Tahun ajaran
                </label>
                <select
                  id="tahun_ajaran_id"
                  name="tahun_ajaran_id"
                  className="select"
                  required
                >
                  <option value="">Pilih tahun ajaran</option>
                  {tahunAjaran.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.nama}
                      {ta.is_active ? " (aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="spreadsheet_id">
                  Spreadsheet ID
                </label>
                <input
                  id="spreadsheet_id"
                  name="spreadsheet_id"
                  className="input font-mono text-xs"
                  placeholder="1AbC..."
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  value="1"
                  defaultChecked
                  className="accent-[var(--accent)]"
                />
                Jadikan spreadsheet aktif
              </label>
              <div className="sm:text-right">
                <SubmitButton className="btn btn-primary btn-sm">
                  Simpan konfigurasi
                </SubmitButton>
              </div>
            </form>
          </div>

          <p className="muted mt-3 text-xs">
            Bagikan spreadsheet ke email service account sebagai{" "}
            <strong>Editor</strong>. Satu tab dibuat per bulan dengan nama{" "}
            <code className="font-mono">Presensi YYYY-MM</code>.
          </p>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">Cara kerja</h2>
          <ol className="muted list-inside list-decimal space-y-2 text-xs">
            <li>Absensi disimpan ke Supabase lebih dulu.</li>
            <li>
              Job sinkronisasi masuk antrean, lalu diproses langsung setelah
              respons (tidak menahan pengguna).
            </li>
            <li>
              Cron harian Vercel mencoba ulang job yang gagal dan menjalankan
              retensi otomatis.
            </li>
            <li>
              Jika Sheets gagal, absensi tetap aman dan job dicoba lagi nanti.
            </li>
          </ol>
          <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-xs">
            <p className="font-semibold">Endpoint cron</p>
            <p className="muted mt-0.5 font-mono">GET /api/cron/daily</p>
            <p className="muted mt-1">
              Header <code className="font-mono">Authorization: Bearer CRON_SECRET</code>
            </p>
          </div>
        </section>
      </div>

      <section className="card mt-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="section-title">Antrean terbaru</h2>
          <Link href="/admin/sinkronisasi" className="muted text-xs hover:underline">
            Muat ulang
          </Link>
        </div>

        {jobs.length === 0 ? (
          <Empty
            icon="sync"
            title="Antrean kosong"
            description="Job muncul setelah absensi disimpan."
          />
        ) : (
          <div className="table-wrap">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Ekskul</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Percobaan</th>
                  <th className="hidden sm:table-cell">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="font-medium">
                      {job.ekskul?.nama ?? "-"}
                      {job.action === "delete" ? (
                        <span className="badge badge-sakit ml-1">hapus</span>
                      ) : null}
                    </td>
                    <td className="muted text-sm" data-label="Tanggal">
                      <span className="sm:hidden">
                        {formatTanggalPendek(job.tanggal)}
                      </span>
                      <span className="hidden sm:inline">
                        {formatTanggalLengkapPendek(job.tanggal)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={STATUS_CLASS[job.status]}>
                        {STATUS_LABEL[job.status]}
                      </span>
                    </td>
                    <td
                      className="hidden tabular-nums sm:table-cell"
                      data-label="Percobaan"
                    >
                      {job.attempts}
                    </td>
                    <td
                      className="muted hidden max-w-xs truncate text-xs sm:table-cell"
                      data-label="Catatan"
                    >
                      {job.last_error ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
