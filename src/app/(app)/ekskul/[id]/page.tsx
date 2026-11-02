import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getKelasMap } from "@/lib/queries/master";
import { PageHeader } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { Icon } from "@/components/ui/icons";
import { EkskulForm } from "@/components/admin/ekskul-form";
import { StudentPicker } from "@/components/admin/student-picker";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  removeMemberAction,
  toggleEkskulActiveAction,
} from "@/lib/actions/admin";
import {
  formatTanggalLengkapPendek,
  labelHari,
  todayISO,
} from "@/lib/utils/tanggal";
import { persen } from "@/lib/utils/format";
import type { Ekskul, EkskulJadwal, Profile } from "@/types/db";

export const dynamic = "force-dynamic";

interface EkskulDetail extends Ekskul {
  ekskul_jadwal: EkskulJadwal[];
  ekskul_pic: Array<{
    is_primary: boolean;
    profile: { id: string; nama: string; username: string } | null;
  }>;
}

export default async function EkskulDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();
  const isAdmin = session.profile.role === "admin";

  if (!isAdmin) {
    const { data: link } = await supabase
      .from("ekskul_pic")
      .select("ekskul_id")
      .eq("ekskul_id", id)
      .eq("profile_id", session.profile.id)
      .maybeSingle();
    if (!link) notFound();
  }

  const { data: ekskulData } = await supabase
    .from("ekskul")
    .select(
      "id,nama,deskripsi,is_active,created_at,ekskul_jadwal(hari),ekskul_pic(is_primary,profile:profile_id(id,nama,username))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!ekskulData) notFound();
  const ekskul = ekskulData as unknown as EkskulDetail;
  const hari = (ekskul.ekskul_jadwal ?? []).map((j) => j.hari).sort();
  const pics = (ekskul.ekskul_pic ?? [])
    .map((p) => p.profile)
    .filter(
      (p): p is { id: string; nama: string; username: string } => Boolean(p),
    );

  const [membersRes, dailyRes, settingsRes, profilesRes, studentsRes] =
    await Promise.all([
      supabase
        .from("members")
        .select(
          "id,joined_at,student:student_id(id,nama,nis,kelas_id)",
        )
        .eq("ekskul_id", id)
        .is("left_at", null),
      supabase
        .from("attendance_daily")
        .select("tanggal,total,hadir,izin,sakit,alpha")
        .eq("ekskul_id", id)
        .order("tanggal", { ascending: false })
        .limit(12),
      supabase.from("app_settings").select("timezone").eq("id", true).maybeSingle(),
      isAdmin
        ? supabase
            .from("profiles")
            .select("id,nama,username,role")
            .eq("role", "pic")
            .eq("is_active", true)
            .order("nama")
        : Promise.resolve({ data: [] as Array<Profile> }),
      isAdmin
        ? supabase
            .from("students")
            .select("id,nama,nis,kelas_id")
            .eq("status", "aktif")
            .order("nama")
            .limit(3000)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              nama: string;
              nis: string | null;
              kelas_id: string | null;
            }>,
          }),
    ]);

  const today = todayISO(
    (settingsRes.data as { timezone?: string } | null)?.timezone ??
      "Asia/Jakarta",
  );
  const kelasMap = await getKelasMap(supabase);

  const members = (
    (membersRes.data ?? []) as unknown as Array<{
      id: string;
      joined_at: string;
      student: {
        id: string;
        nama: string;
        nis: string | null;
        kelas_id: string | null;
      } | null;
    }>
  )
    .filter((row) => row.student)
    .map((row) => ({
      memberId: row.id,
      joinedAt: row.joined_at,
      nama: row.student!.nama,
      nis: row.student!.nis,
      kelas: row.student!.kelas_id
        ? (kelasMap.get(row.student!.kelas_id)?.label ?? "-")
        : "-",
      studentId: row.student!.id,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const memberStudentIds = new Set(members.map((m) => m.studentId));
  const pickable = (
    (studentsRes.data ?? []) as Array<{
      id: string;
      nama: string;
      nis: string | null;
      kelas_id: string | null;
    }>
  )
    .filter((student) => !memberStudentIds.has(student.id))
    .map((student) => ({
      id: student.id,
      nama: student.nama,
      nis: student.nis,
      kelas: student.kelas_id
        ? (kelasMap.get(student.kelas_id)?.label ?? "-")
        : "-",
    }));

  const daily = (dailyRes.data ?? []) as Array<{
    tanggal: string;
    total: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
  }>;
  const totalHadir = daily.reduce((sum, row) => sum + row.hadir, 0);
  const totalCatatan = daily.reduce((sum, row) => sum + row.total, 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Link
          href="/ekskul"
          className="btn btn-ghost btn-sm !min-h-9 !px-2"
          aria-label="Kembali"
        >
          <Icon name="back" className="h-4 w-4" />
        </Link>
        <span className="muted text-xs">Detail ekskul</span>
      </div>

      <PageHeader
        title={ekskul.nama}
        description={`${hari.map((h) => labelHari(h)).join(" & ")} · ${members.length} anggota`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/absen/${ekskul.id}`}
              className="btn btn-primary btn-sm"
            >
              <Icon name="absen" className="h-4 w-4" />
              Absensi
            </Link>
            {isAdmin ? (
              <form action={toggleEkskulActiveAction}>
                <input type="hidden" name="id" value={ekskul.id} />
                <input
                  type="hidden"
                  name="active"
                  value={ekskul.is_active ? "0" : "1"}
                />
                {ekskul.is_active ? (
                  <ConfirmSubmit
                    className="btn btn-ghost btn-sm"
                    message={`Arsipkan ${ekskul.nama}? Ekskul tidak muncul di daftar absensi, tetapi semua riwayat tetap tersimpan.`}
                  >
                    <Icon name="archive" className="h-4 w-4" />
                    Arsipkan
                  </ConfirmSubmit>
                ) : (
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Aktifkan
                  </button>
                )}
              </form>
            ) : null}
          </div>
        }
      />

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">Anggota aktif</h2>
              <span className="badge badge-muted">{members.length} siswa</span>
            </div>

            {members.length === 0 ? (
              <Empty
                icon="users"
                title="Belum ada anggota"
                description={
                  isAdmin
                    ? "Tambahkan siswa lewat formulir di bawah."
                    : "Admin belum menambahkan anggota untuk ekskul ini."
                }
              />
            ) : (
              <div className="table-wrap -mx-1">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th className="hidden sm:table-cell">Kelas</th>
                      <th className="hidden sm:table-cell">Bergabung</th>
                      {isAdmin ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.memberId}>
                        <td>
                          <Link
                            href={`/siswa/${member.studentId}`}
                            className="font-medium hover:underline"
                          >
                            {member.nama}
                          </Link>
                          <p className="muted text-xs sm:hidden">
                            {member.kelas}
                            {member.nis ? ` · ${member.nis}` : ""}
                          </p>
                          {member.nis ? (
                            <p className="muted hidden text-xs sm:block">
                              NIS {member.nis}
                            </p>
                          ) : null}
                        </td>
                        <td className="hidden sm:table-cell">{member.kelas}</td>
                        <td className="muted hidden text-xs sm:table-cell">
                          {formatTanggalLengkapPendek(member.joinedAt)}
                        </td>
                        {isAdmin ? (
                          <td className="text-right">
                            <form action={removeMemberAction}>
                              <input
                                type="hidden"
                                name="ekskul_id"
                                value={ekskul.id}
                              />
                              <input
                                type="hidden"
                                name="member_id"
                                value={member.memberId}
                              />
                              <ConfirmSubmit
                                className="btn btn-ghost btn-sm !px-2"
                                message={`Keluarkan ${member.nama} dari ${ekskul.nama}? Riwayat absensi tetap tersimpan.`}
                                title="Keluarkan"
                              >
                                <Icon name="close" className="h-4 w-4" />
                              </ConfirmSubmit>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isAdmin ? (
            <section className="card p-4">
              <h2 className="section-title mb-3">Tambah anggota</h2>
              <StudentPicker
                ekskulId={ekskul.id}
                students={pickable}
                today={today}
              />
            </section>
          ) : null}

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="section-title">Sesi terakhir</h2>
              <Link
                href={`/laporan?ekskul=${ekskul.id}`}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Laporan lengkap
              </Link>
            </div>

            {daily.length === 0 ? (
              <Empty
                icon="calendar"
                title="Belum ada sesi"
                description="Ringkasan sesi muncul setelah absensi pertama disimpan."
              />
            ) : (
              <>
                <p className="muted mb-2 text-xs">
                  Kehadiran dari {daily.length} sesi terakhir:{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {totalCatatan ? persen(totalHadir, totalCatatan) : "-"}
                  </span>
                </p>
                <ul className="divide-y">
                  {daily.map((row) => (
                    <li
                      key={row.tanggal}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link
                        href={`/absen/${ekskul.id}?tanggal=${row.tanggal}`}
                        className="min-w-0 truncate font-medium hover:underline"
                      >
                        {formatTanggalLengkapPendek(row.tanggal)}
                      </Link>
                      <span className="muted shrink-0 text-xs">
                        {row.hadir}/{row.total} hadir
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="section-title mb-2">PIC</h2>
            {pics.length === 0 ? (
              <p className="muted text-sm">Belum ada PIC.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {pics.map((pic) => (
                  <li key={pic.id} className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
                      style={{
                        background: "var(--surface-2)",
                        color: "var(--accent)",
                      }}
                    >
                      {pic.nama.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {pic.nama}
                      </span>
                      <span className="muted block truncate text-xs">
                        @{pic.username}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isAdmin ? (
            <section className="card p-4">
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  Ubah nama, jadwal, dan PIC
                </summary>
                <div className="mt-3">
                  <EkskulForm
                    ekskul={ekskul}
                    hari={hari}
                    pics={(ekskul.ekskul_pic ?? []).map((item) => ({
                      profile_id: item.profile?.id ?? "",
                      is_primary: item.is_primary,
                    }))}
                    profiles={
                      (profilesRes.data ?? []) as Array<
                        Pick<Profile, "id" | "nama" | "username">
                      >
                    }
                    submitLabel="Simpan perubahan"
                  />
                </div>
              </details>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
