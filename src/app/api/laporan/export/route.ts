import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listEkskulForUser } from "@/lib/queries/absensi";
import { csvEscape } from "@/lib/utils/csv";
import { persen } from "@/lib/utils/format";
import type { LaporanRow } from "@/types/db";

export const dynamic = "force-dynamic";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const ekskulId = params.get("ekskul") ?? "";
  const dari = params.get("dari");
  const sampai = params.get("sampai");

  if (!ekskulId || !validDate(dari) || !validDate(sampai)) {
    return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
  }

  const supabase = await createClient();
  const allowed = await listEkskulForUser(
    supabase,
    session.profile.id,
    session.profile.role,
  );
  const ekskul = allowed.find((item) => item.id === ekskulId);
  if (!ekskul) {
    return NextResponse.json({ error: "Tidak punya akses." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("laporan_kehadiran", {
    p_ekskul: ekskulId,
    p_dari: dari,
    p_sampai: sampai,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as LaporanRow[];
  const header = [
    "Nama",
    "NIS",
    "Kelas",
    "Sesi",
    "Hadir",
    "Izin",
    "Sakit",
    "Alpha",
    "Persentase hadir",
  ];

  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        row.nama,
        row.nis ?? "",
        row.kelas,
        row.sesi,
        row.hadir,
        row.izin,
        row.sakit,
        row.alpha,
        persen(row.hadir, row.sesi),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const safeName = ekskul.nama.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `laporan-${safeName}-${dari}-${sampai}.csv`;

  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
