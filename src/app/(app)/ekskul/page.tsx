import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { Icon } from "@/components/ui/icons";
import { EkskulForm } from "@/components/admin/ekskul-form";
import { labelHari } from "@/lib/utils/tanggal";
import type { Profile } from "@/types/db";

export const dynamic = "force-dynamic";

interface EkskulRow {
  id: string;
  nama: string;
  is_active: boolean;
  ekskul_jadwal: Array<{ hari: number }>;
  ekskul_pic: Array<{
    is_primary: boolean;
    profile: { id: string; nama: string; username: string } | null;
  }>;
}

export default async function EkskulPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; arsip?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const showArsip = params.arsip === "1";

  const [ekskulRes, profilesRes, membersRes] = await Promise.all([
    supabase
      .from("ekskul")
      .select(
        "id,nama,is_active,created_at,ekskul_jadwal(hari),ekskul_pic(is_primary,profile:profile_id(id,nama,username))",
      )
      .order("is_active", { ascending: false })
      .order("nama"),
    supabase
      .from("profiles")
      .select("id,nama,username,role")
      .eq("role", "pic")
      .eq("is_active", true)
      .order("nama"),
    supabase.from("members").select("ekskul_id").is("left_at", null),
  ]);

  const ekskul = (ekskulRes.data ?? []) as unknown as EkskulRow[];
  const profiles = (profilesRes.data ?? []) as Array<
    Pick<Profile, "id" | "nama" | "username">
  >;

  const memberCount = new Map<string, number>();
  for (const row of (membersRes.data ?? []) as Array<{ ekskul_id: string }>) {
    memberCount.set(row.ekskul_id, (memberCount.get(row.ekskul_id) ?? 0) + 1);
  }

  const visible = ekskul.filter((item) => showArsip || item.is_active);
  const aktifCount = ekskul.filter((item) => item.is_active).length;
  const arsipCount = ekskul.length - aktifCount;

  return (
    <div>
      <PageHeader
        title="Ekskul"
        description={`${aktifCount} ekskul aktif · ${arsipCount} diarsipkan`}
        action={
          <a href="#tambah" className="btn btn-primary btn-sm">
            <Icon name="plus" className="h-4 w-4" />
            Tambah
          </a>
        }
      />

      <Flash ok={params.ok} error={params.error} />

      <div className="mb-3 flex gap-1 rounded-lg border p-1 text-sm">
        <Link
          href="/ekskul"
          className="flex-1 rounded-md px-3 py-1.5 text-center font-semibold"
          style={
            !showArsip
              ? { background: "var(--accent-soft)", color: "var(--accent)" }
              : { color: "var(--muted)" }
          }
        >
          Aktif
        </Link>
        <Link
          href="/ekskul?arsip=1"
          className="flex-1 rounded-md px-3 py-1.5 text-center font-semibold"
          style={
            showArsip
              ? { background: "var(--accent-soft)", color: "var(--accent)" }
              : { color: "var(--muted)" }
          }
        >
          Diarsipkan
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <Empty
            icon="school"
            title={showArsip ? "Tidak ada ekskul diarsipkan" : "Belum ada ekskul"}
            description="Tambahkan ekskul lewat formulir di bawah halaman ini."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((item) => {
            const hari = (item.ekskul_jadwal ?? [])
              .map((j) => j.hari)
              .sort();
            const pics = (item.ekskul_pic ?? [])
              .map((p) => p.profile)
              .filter(
                (p): p is { id: string; nama: string; username: string } =>
                  Boolean(p),
              );
            return (
              <Link
                key={item.id}
                href={`/ekskul/${item.id}`}
                className="card flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.nama}</p>
                    <p className="muted text-xs">
                      {hari.map((h) => labelHari(h)).join(" & ") || "Belum ada jadwal"}
                    </p>
                  </div>
                  <span
                    className={
                      item.is_active
                        ? "badge badge-hadir"
                        : "badge badge-muted"
                    }
                  >
                    {item.is_active ? "Aktif" : "Arsip"}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 text-xs">
                  <span className="muted truncate">
                    {pics.length > 0
                      ? pics.map((p) => p.nama).join(", ")
                      : "Belum ada PIC"}
                  </span>
                  <span className="badge badge-muted shrink-0">
                    {memberCount.get(item.id) ?? 0} anggota
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <section id="tambah" className="card mt-6 scroll-mt-20 p-4">
        <h2 className="section-title mb-3">Tambah ekskul</h2>
        <EkskulForm profiles={profiles} submitLabel="Simpan ekskul" />
      </section>
    </div>
  );
}
