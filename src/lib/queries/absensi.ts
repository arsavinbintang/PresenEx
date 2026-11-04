import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, isodow, todayISO } from "@/lib/utils/tanggal";
import { getAppSettings, getKelasMap } from "@/lib/queries/master";
import type { AttendanceStatus, Ekskul, EkskulJadwal } from "@/types/db";

export interface EkskulWithJadwal extends Ekskul {
  ekskul_jadwal: EkskulJadwal[];
}

export interface RosterItem {
  memberId: string;
  studentId: string;
  nama: string;
  nis: string | null;
  kelas: string;
  status: AttendanceStatus;
  catatan: string;
}

export interface SessionHistoryItem {
  tanggal: string;
  terisi: boolean;
  hadir: number;
  total: number;
}

export interface AttendancePageData {
  ekskul: EkskulWithJadwal;
  tanggal: string;
  today: string;
  timezone: string;
  hari: number[];
  isScheduled: boolean;
  isLibur: boolean;
  roster: RosterItem[];
  history: SessionHistoryItem[];
  windowMonths: number;
  isAdmin: boolean;
  canEdit: boolean;
}

export function scheduledDatesInRange(
  hari: number[],
  from: string,
  to: string,
  libur: Set<string>,
): string[] {
  const out: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 800) {
    if (hari.includes(isodow(cursor)) && !libur.has(cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

export async function listEkskulForUser(
  supabase: SupabaseClient,
  profileId: string,
  role: string,
): Promise<EkskulWithJadwal[]> {
  if (role === "admin") {
    const { data } = await supabase
      .from("ekskul")
      .select("id,nama,deskripsi,is_active,created_at,ekskul_jadwal(hari)")
      .eq("is_active", true)
      .order("nama");
    return (data ?? []) as unknown as EkskulWithJadwal[];
  }

  const { data: links } = await supabase
    .from("ekskul_pic")
    .select("ekskul:ekskul_id(id,nama,deskripsi,is_active,created_at,ekskul_jadwal(hari))")
    .eq("profile_id", profileId);

  return ((links ?? []) as unknown as Array<{ ekskul: EkskulWithJadwal | null }>)
    .map((row) => row.ekskul)
    .filter((e): e is EkskulWithJadwal => Boolean(e?.is_active))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function getAttendancePageData(
  supabase: SupabaseClient,
  ekskulId: string,
  tanggalParam: string | undefined,
): Promise<AttendancePageData | null> {
  const [settings, kelasMap, ekskulRes] = await Promise.all([
    getAppSettings(),
    getKelasMap(supabase),
    supabase
      .from("ekskul")
      .select("id,nama,deskripsi,is_active,created_at,ekskul_jadwal(hari)")
      .eq("id", ekskulId)
      .maybeSingle(),
  ]);
  const timezone = settings?.timezone ?? "Asia/Jakarta";
  const today = todayISO(timezone);
  const windowMonths = settings?.edit_window_months ?? 6;

  const ekskulData = ekskulRes.data;
  if (!ekskulData) return null;
  const ekskul = ekskulData as unknown as EkskulWithJadwal;
  const hari = (ekskul.ekskul_jadwal ?? []).map((j) => j.hari).sort();

  const from = addMonths(today, -6);

  const [liburRes, dailyRes] = await Promise.all([
    supabase
      .from("sesi_libur")
      .select("tanggal")
      .eq("ekskul_id", ekskulId)
      .gte("tanggal", from),
    supabase
      .from("attendance_daily")
      .select("tanggal,hadir,total")
      .eq("ekskul_id", ekskulId)
      .gte("tanggal", from),
  ]);

  const libur = new Set(
    ((liburRes.data ?? []) as Array<{ tanggal: string }>).map((r) => r.tanggal),
  );
  const dailyMap = new Map(
    ((dailyRes.data ?? []) as Array<{
      tanggal: string;
      hadir: number;
      total: number;
    }>).map((r) => [r.tanggal, r]),
  );

  const scheduled = scheduledDatesInRange(hari, from, today, libur);
  const lastSessions = scheduled.slice(-8).reverse();

  let tanggal = tanggalParam;
  if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    if (hari.includes(isodow(today)) && !dailyMap.has(today)) {
      tanggal = today;
    } else {
      const missing = [...scheduled]
        .reverse()
        .find((d) => !dailyMap.has(d));
      tanggal = missing ?? scheduled[scheduled.length - 1] ?? today;
    }
  }
  if (tanggal > today) tanggal = today;

  const [{ data: memberRows }, { data: attRows }] = await Promise.all([
    supabase
      .from("members")
      .select("id,student_id,joined_at,left_at,student:student_id(id,nama,nis,kelas_id)")
      .eq("ekskul_id", ekskulId)
      .lte("joined_at", tanggal)
      .or(`left_at.is.null,left_at.gte.${tanggal}`)
      .order("joined_at"),
    supabase
      .from("attendance")
      .select("member_id,status,catatan")
      .eq("ekskul_id", ekskulId)
      .eq("tanggal", tanggal),
  ]);

  const attMap = new Map(
    ((attRows ?? []) as Array<{
      member_id: string;
      status: AttendanceStatus;
      catatan: string | null;
    }>).map((r) => [r.member_id, r]),
  );

  const roster: RosterItem[] = (
    (memberRows ?? []) as unknown as Array<{
      id: string;
      student_id: string;
      student: {
        id: string;
        nama: string;
        nis: string | null;
        kelas_id: string | null;
      } | null;
    }>
  )
    .filter((row) => row.student)
    .map((row) => {
      const student = row.student!;
      const att = attMap.get(row.id);
      return {
        memberId: row.id,
        studentId: row.student_id,
        nama: student.nama,
        nis: student.nis,
        kelas: student.kelas_id
          ? (kelasMap.get(student.kelas_id)?.label ?? "-")
          : "-",
        status: att?.status ?? "hadir",
        catatan: att?.catatan ?? "",
      };
    });

  const isAdmin = false;
  const windowMin = addMonths(today, -windowMonths);
  const canEdit = tanggal >= windowMin && tanggal <= today;

  return {
    ekskul,
    tanggal,
    today,
    timezone,
    hari,
    isScheduled: hari.includes(isodow(tanggal)),
    isLibur: libur.has(tanggal),
    roster,
    history: lastSessions.map((d) => {
      const row = dailyMap.get(d);
      return {
        tanggal: d,
        terisi: Boolean(row),
        hadir: row?.hadir ?? 0,
        total: row?.total ?? 0,
      };
    }),
    windowMonths,
    isAdmin,
    canEdit,
  };
}
