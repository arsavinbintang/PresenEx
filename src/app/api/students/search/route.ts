import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getKelasMap } from "@/lib/queries/master";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const SCAN = 60;

/**
 * Pencarian siswa berbasis server untuk pemilih anggota ekskul.
 * Data ~2000 siswa tidak pernah dikirim ke browser; browser hanya menerima
 * maksimal 20 hasil yang cocok dengan kata kunci.
 *
 * GET /api/students/search?q=rpl&ekskul_id=...
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Belum login." }, { status: 401 });
  }

  const url = new URL(request.url);
  // Buang karakter khusus PostgREST (koma, kurung) agar filter aman.
  const q = (url.searchParams.get("q") ?? "")
    .slice(0, 60)
    .replace(/[^0-9a-zA-Z .'-]/g, "")
    .trim();
  const ekskulId = (url.searchParams.get("ekskul_id") ?? "").trim();

  if (!ekskulId) {
    return NextResponse.json(
      { ok: false, message: "Ekskul tidak ditemukan." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (session.profile.role !== "admin") {
    const { data: link } = await supabase
      .from("ekskul_pic")
      .select("ekskul_id")
      .eq("ekskul_id", ekskulId)
      .eq("profile_id", session.profile.id)
      .maybeSingle();
    if (!link) {
      return NextResponse.json(
        { ok: false, message: "Anda bukan PIC ekskul ini." },
        { status: 403 },
      );
    }
  }

  if (q.length < 1) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  const [studentsRes, membersRes] = await Promise.all([
    supabase
      .from("students")
      .select("id,nama,nis,kelas_id")
      .eq("status", "aktif")
      .or(`nama.ilike.${pattern},nis.ilike.${pattern}`)
      .order("nama")
      .limit(SCAN),
    supabase
      .from("members")
      .select("student_id")
      .eq("ekskul_id", ekskulId)
      .is("left_at", null),
  ]);

  if (studentsRes.error) {
    return NextResponse.json(
      { ok: false, message: studentsRes.error.message },
      { status: 500 },
    );
  }

  const sudahAnggota = new Set(
    ((membersRes.data ?? []) as Array<{ student_id: string }>).map(
      (row) => row.student_id,
    ),
  );

  const kelasMap = await getKelasMap(supabase);

  const results = ((studentsRes.data ?? []) as Array<{
    id: string;
    nama: string;
    nis: string | null;
    kelas_id: string | null;
  }>)
    .filter((student) => !sudahAnggota.has(student.id))
    .slice(0, LIMIT)
    .map((student) => ({
      id: student.id,
      nama: student.nama,
      nis: student.nis,
      kelas: student.kelas_id
        ? (kelasMap.get(student.kelas_id)?.label ?? "-")
        : "-",
    }));

  return NextResponse.json({ ok: true, results });
}
