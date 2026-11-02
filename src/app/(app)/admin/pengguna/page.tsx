import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/ui/flash";
import { Icon } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  createPenggunaAction,
  resetPasswordAction,
  togglePenggunaAction,
} from "@/lib/actions/admin";
import { formatTanggalPendek } from "@/lib/utils/tanggal";
import type { Profile } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PenggunaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await requireAdmin();
  const supabase = await createClient();

  const [profilesRes, linksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,nama,role,is_active,created_at")
      .order("role")
      .order("nama"),
    supabase
      .from("ekskul_pic")
      .select("profile_id,ekskul:ekskul_id(nama,is_active)"),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const ekskulByProfile = new Map<string, string[]>();
  for (const row of (linksRes.data ?? []) as unknown as Array<{
    profile_id: string;
    ekskul: { nama: string; is_active: boolean } | null;
  }>) {
    if (!row.ekskul) continue;
    const list = ekskulByProfile.get(row.profile_id) ?? [];
    list.push(row.ekskul.nama);
    ekskulByProfile.set(row.profile_id, list);
  }

  const admins = profiles.filter((profile) => profile.role === "admin").length;
  const pics = profiles.filter((profile) => profile.role === "pic").length;

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description={`${admins} admin · ${pics} PIC`}
      />

      <Flash ok={params.ok} error={params.error} />

      <section className="card mb-4 p-4">
        <h2 className="section-title mb-3">Buat akun</h2>
        <form
          action={createPenggunaAction}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              className="input"
              placeholder="budi.pic"
              autoCapitalize="none"
              autoComplete="off"
              required
              maxLength={32}
            />
          </div>
          <div>
            <label className="label" htmlFor="nama">
              Nama lengkap
            </label>
            <input
              id="nama"
              name="nama"
              className="input"
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password awal
            </label>
            <input
              id="password"
              name="password"
              type="text"
              className="input"
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="role">
              Peran
            </label>
            <select id="role" name="role" className="select">
              <option value="pic">PIC</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton className="btn btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              Buat akun
            </SubmitButton>
          </div>
        </form>
        <p className="muted mt-2 text-xs">
          Login memakai username, bukan email. Berikan password awal ke
          pemilik akun lalu minta mereka menggantinya.
        </p>
      </section>

      <div className="space-y-2">
        {profiles.map((profile) => {
          const ekskul = ekskulByProfile.get(profile.id) ?? [];
          const isSelf = profile.id === session.profile.id;

          return (
            <details key={profile.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--accent)",
                  }}
                >
                  {profile.nama.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {profile.nama}
                    {isSelf ? (
                      <span className="muted ml-1 text-xs">(Anda)</span>
                    ) : null}
                  </span>
                  <span className="muted block truncate text-xs">
                    @{profile.username}
                  </span>
                </span>
                <span
                  className={
                    profile.role === "admin"
                      ? "badge badge-izin"
                      : "badge badge-muted"
                  }
                >
                  {profile.role === "admin" ? "Admin" : "PIC"}
                </span>
                <span
                  className={
                    profile.is_active ? "badge badge-hadir" : "badge badge-alpha"
                  }
                >
                  {profile.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <Icon
                  name="edit"
                  className="h-4 w-4 shrink-0 text-[var(--muted)]"
                />
              </summary>

              <div className="mt-3 space-y-3 border-t pt-3">
                <p className="muted text-xs">
                  Dibuat {formatTanggalPendek(profile.created_at.slice(0, 10))}
                  {ekskul.length > 0
                    ? ` · Ekskul: ${ekskul.join(", ")}`
                    : profile.role === "pic"
                      ? " · Belum memegang ekskul"
                      : ""}
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <form action={resetPasswordAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={profile.id} />
                    <div>
                      <label className="label">Password baru</label>
                      <input
                        name="password"
                        type="text"
                        className="input"
                        minLength={6}
                        required
                        autoComplete="new-password"
                        placeholder="min. 6 karakter"
                      />
                    </div>
                    <SubmitButton className="btn btn-ghost btn-sm">
                      Reset password
                    </SubmitButton>
                  </form>

                  {!isSelf ? (
                    <form action={togglePenggunaAction}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={profile.is_active ? "0" : "1"}
                      />
                      {profile.is_active ? (
                        <ConfirmSubmit
                          className="btn btn-danger btn-sm"
                          message={`Nonaktifkan akun ${profile.username}? Pengguna tidak bisa login sampai diaktifkan lagi.`}
                        >
                          Nonaktifkan
                        </ConfirmSubmit>
                      ) : (
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Aktifkan
                        </button>
                      )}
                    </form>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
