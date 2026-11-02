import { saveEkskulAction } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { HARI } from "@/lib/utils/tanggal";
import type { EkskulJadwal, Profile } from "@/types/db";

export interface EkskulPicInfo {
  profile_id: string;
  is_primary: boolean;
}

export function EkskulForm({
  ekskul,
  hari = [],
  pics = [],
  profiles,
  submitLabel,
}: {
  ekskul?: { id: string; nama: string; deskripsi: string | null };
  hari?: number[] | EkskulJadwal[];
  pics?: EkskulPicInfo[];
  profiles: Pick<Profile, "id" | "nama" | "username">[];
  submitLabel: string;
}) {
  const hariTerpilih = new Set(
    hari.map((item) => (typeof item === "number" ? item : item.hari)),
  );
  const picTerpilih = new Set(pics.map((item) => item.profile_id));
  const primary =
    pics.find((item) => item.is_primary)?.profile_id ??
    pics[0]?.profile_id ??
    "";

  return (
    <form action={saveEkskulAction} className="space-y-4">
      {ekskul ? <input type="hidden" name="id" value={ekskul.id} /> : null}

      <div>
        <label className="label" htmlFor="nama">
          Nama ekskul
        </label>
        <input
          id="nama"
          name="nama"
          className="input"
          defaultValue={ekskul?.nama ?? ""}
          placeholder="contoh: Pramuka"
          required
          maxLength={80}
        />
      </div>

      <div>
        <span className="label">Hari pertemuan</span>
        <div className="flex flex-wrap gap-1.5">
          {HARI.map((nama, index) => {
            const value = index + 1;
            return (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm has-checked:border-[var(--accent)] has-checked:bg-[var(--accent-soft)] has-checked:text-[var(--accent)]"
              >
                <input
                  type="checkbox"
                  name="hari"
                  value={value}
                  defaultChecked={hariTerpilih.has(value)}
                  className="accent-[var(--accent)]"
                />
                {nama}
              </label>
            );
          })}
        </div>
        <p className="muted mt-1 text-xs">Pilih 1–7 hari. Default satu hari.</p>
      </div>

      <div>
        <span className="label">PIC</span>
        {profiles.length === 0 ? (
          <p className="muted text-sm">
            Belum ada akun PIC. Buat dulu di menu Pengguna.
          </p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm"
              >
                <input
                  id={`pic-${profile.id}`}
                  type="checkbox"
                  name="pic"
                  value={profile.id}
                  defaultChecked={picTerpilih.has(profile.id)}
                  className="accent-[var(--accent)]"
                />
                <label
                  htmlFor={`pic-${profile.id}`}
                  className="min-w-0 flex-1 cursor-pointer truncate"
                >
                  {profile.nama}
                  <span className="muted ml-1 text-xs">
                    @{profile.username}
                  </span>
                </label>
                <label
                  className="muted flex cursor-pointer items-center gap-1 text-[0.7rem]"
                  title="PIC utama"
                >
                  <input
                    type="radio"
                    name="primary"
                    value={profile.id}
                    defaultChecked={primary === profile.id}
                    className="accent-[var(--accent)]"
                  />
                  utama
                </label>
              </div>
            ))}
          </div>
        )}
        <p className="muted mt-1 text-xs">
          Satu ekskul boleh punya beberapa PIC. PIC utama dipakai sebagai
          penanggung jawab utama.
        </p>
      </div>

      <SubmitButton className="btn btn-primary w-full sm:w-auto">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
