import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { ActionModal } from "@/components/ui/action-modal";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandMark } from "@/components/ui/brand";
import {
  deleteSponsorAction,
  rebuildDailyAction,
  removeLogoAction,
  saveLogoAction,
  saveSettingsAction,
  saveSponsorAction,
  toggleSponsorAction,
} from "@/lib/actions/admin";
import { assetUrl } from "@/lib/utils/asset";
import { addMonths, todayISO } from "@/lib/utils/tanggal";

export const dynamic = "force-dynamic";

function SponsorForm({
  id,
  sponsor,
}: {
  id?: string;
  sponsor?: { nama: string; url: string | null; urutan: number };
}) {
  return (
    <form action={saveSponsorAction} className="space-y-3">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <div>
        <label className="label" htmlFor={`sponsor-nama-${id ?? "baru"}`}>
          Nama sponsor
        </label>
        <input
          id={`sponsor-nama-${id ?? "baru"}`}
          name="nama"
          className="input"
          defaultValue={sponsor?.nama ?? ""}
          required
          maxLength={80}
          placeholder="PT Maju Jaya"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`sponsor-url-${id ?? "baru"}`}>
            Tautan (opsional)
          </label>
          <input
            id={`sponsor-url-${id ?? "baru"}`}
            name="url"
            className="input"
            defaultValue={sponsor?.url ?? ""}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="label" htmlFor={`sponsor-urutan-${id ?? "baru"}`}>
            Urutan
          </label>
          <input
            id={`sponsor-urutan-${id ?? "baru"}`}
            name="urutan"
            type="number"
            min={0}
            className="input"
            defaultValue={sponsor?.urutan ?? 0}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`sponsor-gambar-${id ?? "baru"}`}>
          Logo {id ? "(kosongkan bila tidak diganti)" : ""}
        </label>
        <input
          id={`sponsor-gambar-${id ?? "baru"}`}
          name="gambar"
          type="file"
          accept="image/*"
          className="input"
          required={!id}
        />
        <p className="muted mt-1 text-xs">
          PNG, JPG, WEBP, atau SVG. Maksimal 1,5 MB.
        </p>
      </div>
      <SubmitButton className="btn btn-primary">
        {id ? "Simpan perubahan" : "Tambah sponsor"}
      </SubmitButton>
    </form>
  );
}

export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const settings = await getAppSettings();
  const supabase = await createClient();
  const { data: semuaSponsor } = await supabase
    .from("sponsors")
    .select("id,nama,url,urutan,path,is_active")
    .order("urutan")
    .order("created_at");
  const daftarSponsor = (semuaSponsor ?? []) as Array<{
    id: string;
    nama: string;
    url: string | null;
    urutan: number;
    path: string;
    is_active: boolean;
  }>;
  const today = todayISO(settings?.timezone ?? "Asia/Jakarta");
  const logoUrl = assetUrl(settings?.logo_path);

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        description="Semua perilaku aplikasi bisa disesuaikan tanpa mengubah kode."
      />

      <Flash ok={params.ok} error={params.error} />

      <form action={saveSettingsAction} className="space-y-4">
        <section className="card p-4">
          <h2 className="section-title mb-3">Identitas & tampilan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nama_sekolah">
                Nama sekolah
              </label>
              <input
                id="nama_sekolah"
                name="nama_sekolah"
                className="input"
                defaultValue={settings?.nama_sekolah ?? ""}
                required
                maxLength={100}
              />
            </div>
            <div>
              <label className="label" htmlFor="warna_aksen">
                Warna aksen
              </label>
              <div className="flex gap-2">
                <input
                  id="warna_aksen"
                  name="warna_aksen"
                  type="color"
                  className="input !w-14 !p-1"
                  defaultValue={settings?.warna_aksen ?? "#2563eb"}
                />
                <input
                  aria-label="Kode warna"
                  className="input flex-1"
                  value={settings?.warna_aksen ?? "#2563eb"}
                  readOnly
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="timezone">
                Zona waktu
              </label>
              <select
                id="timezone"
                name="timezone"
                className="select"
                defaultValue={settings?.timezone ?? "Asia/Jakarta"}
              >
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="backup_drive_folder_id">
                Folder Google Drive backup (opsional)
              </label>
              <input
                id="backup_drive_folder_id"
                name="backup_drive_folder_id"
                className="input"
                defaultValue={settings?.backup_drive_folder_id ?? ""}
                placeholder="ID folder Drive"
              />
            </div>
            <div>
              <label className="label" htmlFor="tema">
                Tema bawaan
              </label>
              <select
                id="tema"
                name="tema"
                className="select"
                defaultValue={settings?.tema ?? "auto"}
              >
                <option value="auto">Ikut sistem perangkat</option>
                <option value="light">Mode terang</option>
                <option value="dark">Mode gelap</option>
              </select>
              <p className="muted mt-1 text-xs">
                Berlaku untuk semua pengguna. Tiap pengguna tetap bisa
                mengganti sendiri lewat tombol tema.{" "}
                <ThemeToggle className="btn btn-ghost btn-sm inline-flex align-middle" />
              </p>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">Absensi</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit_window_months">
                Batas koreksi PIC (bulan)
              </label>
              <input
                id="edit_window_months"
                name="edit_window_months"
                type="number"
                min={1}
                max={24}
                className="input"
                defaultValue={settings?.edit_window_months ?? 6}
                required
              />
              <p className="muted mt-1 text-xs">
                PIC hanya bisa mengisi/mengoreksi sesi dalam rentang ini. Admin
                selalu bebas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["label_hadir", "Hadir"],
                  ["label_izin", "Izin"],
                  ["label_sakit", "Sakit"],
                  ["label_alpha", "Alpha"],
                ] as const
              ).map(([name, fallback]) => (
                <div key={name}>
                  <label className="label" htmlFor={name}>
                    Label {fallback.toLowerCase()}
                  </label>
                  <input
                    id={name}
                    name={name}
                    className="input"
                    defaultValue={
                      (settings?.[name] as string | undefined) ?? fallback
                    }
                    maxLength={20}
                    required
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">Penghapusan siswa lulus</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="purge_after_months">
                Hapus data siswa lulus setelah (bulan)
              </label>
              <input
                id="purge_after_months"
                name="purge_after_months"
                type="number"
                min={0}
                max={24}
                className="input"
                defaultValue={settings?.purge_after_months ?? 3}
                required
              />
              <p className="muted mt-1 text-xs">
                Data pribadi, keanggotaan, dan absensi mentah dihapus. Ringkasan
                harian tetap disimpan.
              </p>
            </div>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                name="purge_sheets"
                value="1"
                defaultChecked={settings?.purge_sheets ?? true}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <span className="font-semibold">Hapus juga dari Google Sheets</span>
                <span className="muted mt-0.5 block text-xs">
                  Baris siswa yang sudah dihapus ikut dibersihkan dari sheet
                  bulanan.
                </span>
              </span>
            </label>
          </div>
          <p className="muted mt-3 text-xs">
            Perkiraan saat ini: siswa lulus sebelum{" "}
            {addMonths(today, -(settings?.purge_after_months ?? 3))} akan masuk
            daftar hapus otomatis.
          </p>
        </section>

        <SubmitButton className="btn btn-primary">
          Simpan pengaturan
        </SubmitButton>
      </form>

      <section className="card mt-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title !mb-0">Logo aplikasi</h2>
            <p className="muted mt-1 text-xs">
              Tampil di sidebar, header, dan halaman login. Maksimal 1,5 MB
              (PNG/JPG/WEBP/SVG).
            </p>
          </div>
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl border"
            aria-hidden
          >
            <BrandMark settings={settings} size="md" />
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <form action={saveLogoAction} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="logo">
                File logo baru
              </label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/*"
                className="input"
                required
              />
            </div>
            <SubmitButton className="btn btn-primary">
              <Icon name="upload" className="h-4 w-4" />
              {logoUrl ? "Ganti logo" : "Unggah logo"}
            </SubmitButton>
          </form>

          {logoUrl ? (
            <form action={removeLogoAction}>
              <ConfirmSubmit
                className="btn btn-ghost"
                message="Kembalikan logo ke tampilan bawaan PresenEx?"
              >
                Kembalikan bawaan
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>
      </section>

      <section className="card mt-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title !mb-0">Logo sponsor</h2>
            <p className="muted mt-1 text-xs">
              Tampil di halaman login. Tambahkan sebanyak apa pun, atur
              urutannya, sembunyikan tanpa menghapus, atau hapus permanen.
            </p>
          </div>
          <ActionModal
            label="Tambah sponsor"
            title="Tambah logo sponsor"
            hint="Unggah gambar logo sponsor milik Anda sendiri."
            icon="image"
          >
            <SponsorForm />
          </ActionModal>
        </div>

        {daftarSponsor.length === 0 ? (
          <p className="muted text-sm">
            Belum ada sponsor. Tekan Tambah sponsor untuk mengunggah logo
            pertama.
          </p>
        ) : (
          <ul className="space-y-2">
            {daftarSponsor.map((sponsor) => {
              const url = assetUrl(sponsor.path);
              return (
                <li
                  key={sponsor.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                  style={sponsor.is_active ? undefined : { opacity: 0.55 }}
                >
                  <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border bg-white">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={sponsor.nama}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    ) : (
                      <Icon name="image" className="h-4 w-4 text-[var(--muted)]" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {sponsor.nama}
                    </span>
                    <span className="muted block text-xs">
                      Urutan {sponsor.urutan}
                      {sponsor.url ? ` · ${sponsor.url}` : ""}
                    </span>
                  </span>

                  <span
                    className={
                      sponsor.is_active ? "badge badge-hadir" : "badge badge-muted"
                    }
                  >
                    {sponsor.is_active ? "Tampil" : "Disembunyikan"}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <ActionModal
                      label="Ubah"
                      title={`Ubah sponsor ${sponsor.nama}`}
                      icon="edit"
                      className="btn btn-ghost btn-sm"
                    >
                      <SponsorForm
                        id={sponsor.id}
                        sponsor={{
                          nama: sponsor.nama,
                          url: sponsor.url,
                          urutan: sponsor.urutan,
                        }}
                      />
                    </ActionModal>

                    <form action={toggleSponsorAction}>
                      <input type="hidden" name="id" value={sponsor.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={sponsor.is_active ? "0" : "1"}
                      />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {sponsor.is_active ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </form>

                    <form action={deleteSponsorAction}>
                      <input type="hidden" name="id" value={sponsor.id} />
                      <ConfirmSubmit
                        className="btn btn-ghost btn-sm !text-[var(--alpha)]"
                        title="Hapus sponsor"
                        message={`Hapus logo sponsor ${sponsor.nama}? File gambarnya ikut dihapus.`}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </ConfirmSubmit>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-6 p-4">
        <h2 className="section-title mb-2">Hitung ulang ringkasan harian</h2>
        <p className="muted mb-3 text-xs">
          Gunakan jika dashboard terlihat tidak cocok dengan data absensi
          (misalnya setelah impor manual ke database). Ringkasan dipakai untuk
          grafik dan laporan cepat.
        </p>
        <form action={rebuildDailyAction} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="dari">
              Dari tanggal
            </label>
            <input
              id="dari"
              type="date"
              name="dari"
              className="input"
              defaultValue={addMonths(today, -6)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="sampai">
              Sampai tanggal
            </label>
            <input
              id="sampai"
              type="date"
              name="sampai"
              className="input"
              defaultValue={today}
              required
            />
          </div>
          <ConfirmSubmit
            className="btn btn-ghost"
            message="Hitung ulang ringkasan harian pada rentang tanggal ini?"
          >
            Hitung ulang
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
