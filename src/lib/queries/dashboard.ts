import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  addMonths,
  formatTanggal,
  isodow,
  labelHari,
  monthKey,
  monthLabelShort,
  rangeMonths,
  todayISO,
} from "@/lib/utils/tanggal";
import { getActiveTA, getSettings } from "@/lib/queries/master";
import type { AttendanceDaily, Ekskul, EkskulJadwal } from "@/types/db";

export interface TodaySession {
  id: string;
  nama: string;
  hari: number[];
  terisi: boolean;
  hadir: number;
  total: number;
}

export interface AttentionItem {
  id: string;
  nama: string;
  hadir: number;
  total: number;
  ratio: number;
  lastDate: string | null;
}

export interface AdminDashboardData {
  namaSekolah: string;
  today: string;
  todayLabel: string;
  totalEkskul: number;
  totalSiswa: number;
  todaySessions: TodaySession[];
  trend: Array<{ label: string; value: number | null }>;
  attention: AttentionItem[];
  hadir30: number;
  total30: number;
  coverage: { tercatat: number; terjadwal: number };
  pendingJobs: number;
  retentionCount: number;
  activeTA: string | null;
}

interface EkskulRow extends Ekskul {
  ekskul_jadwal: EkskulJadwal[];
}

type DailyRow = AttendanceDaily;

function scheduledDates(hari: number[], from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    if (hari.includes(isodow(cursor))) out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

export async function getAdminDashboard(
  supabase: SupabaseClient,
): Promise<AdminDashboardData> {
  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Asia/Jakarta";
  const today = todayISO(timezone);
  const start30 = addDays(today, -29);
  const start180 = addMonths(today, -6);
  const todayHari = isodow(today);

  const [ekskulRes, dailyRes, jobsRes, siswaRes, lulusRes, activeTA] =
    await Promise.all([
      supabase
        .from("ekskul")
        .select("id,nama,is_active,ekskul_jadwal(hari)")
        .eq("is_active", true)
        .order("nama"),
      supabase
        .from("attendance_daily")
        .select("ekskul_id,tanggal,total,hadir,izin,sakit,alpha")
        .gte("tanggal", start180)
        .order("tanggal", { ascending: false }),
      supabase
        .from("sheet_sync_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "failed"]),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "aktif"),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "lulus")
        .eq("purge_hold", false)
        .lte("lulus_at", addMonths(today, -(settings?.purge_after_months ?? 3))),
      getActiveTA(supabase),
    ]);

  const ekskul = (ekskulRes.data ?? []) as unknown as EkskulRow[];
  const daily = (dailyRes.data ?? []) as DailyRow[];

  const dailyToday = new Map<string, DailyRow>();
  const lastDate = new Map<string, string>();
  for (const row of daily) {
    if (row.tanggal === today) dailyToday.set(row.ekskul_id, row);
    if (!lastDate.has(row.ekskul_id)) lastDate.set(row.ekskul_id, row.tanggal);
  }

  const todaySessions: TodaySession[] = ekskul
    .filter((e) => (e.ekskul_jadwal ?? []).some((j) => j.hari === todayHari))
    .map((e) => {
      const d = dailyToday.get(e.id);
      return {
        id: e.id,
        nama: e.nama,
        hari: (e.ekskul_jadwal ?? []).map((j) => j.hari),
        terisi: Boolean(d),
        hadir: d?.hadir ?? 0,
        total: d?.total ?? 0,
      };
    });

  const monthKeys = rangeMonths(monthKey(today), 6);
  const monthAgg = new Map<string, { hadir: number; total: number }>();
  for (const key of monthKeys) monthAgg.set(key, { hadir: 0, total: 0 });

  let hadir30 = 0;
  let total30 = 0;
  const perEkskul = new Map<
    string,
    { hadir: number; total: number; dates: Set<string> }
  >();

  for (const row of daily) {
    const key = monthKey(row.tanggal);
    const agg = monthAgg.get(key);
    if (agg) {
      agg.hadir += row.hadir;
      agg.total += row.total;
    }
    if (row.tanggal >= start30) {
      hadir30 += row.hadir;
      total30 += row.total;
      const entry = perEkskul.get(row.ekskul_id) ?? {
        hadir: 0,
        total: 0,
        dates: new Set<string>(),
      };
      entry.hadir += row.hadir;
      entry.total += row.total;
      entry.dates.add(row.tanggal);
      perEkskul.set(row.ekskul_id, entry);
    }
  }

  const trend = monthKeys.map((key) => {
    const agg = monthAgg.get(key);
    return {
      label: monthLabelShort(key),
      value: agg && agg.total > 0 ? Math.round((agg.hadir / agg.total) * 100) : null,
    };
  });

  let terjadwal = 0;
  const recordedDates = new Set<string>();
  for (const e of ekskul) {
    const hari = (e.ekskul_jadwal ?? []).map((j) => j.hari);
    terjadwal += scheduledDates(hari, start30, today).length;
  }
  for (const row of daily) {
    if (row.tanggal >= start30) recordedDates.add(`${row.tanggal}`);
  }

  const attention: AttentionItem[] = ekskul
    .map((e) => {
      const agg = perEkskul.get(e.id);
      const total = agg?.total ?? 0;
      const hadir = agg?.hadir ?? 0;
      const ratio = total ? hadir / total : 0;
      return {
        id: e.id,
        nama: e.nama,
        hadir,
        total,
        ratio,
        lastDate: lastDate.get(e.id) ?? null,
      };
    })
    .filter((item) => item.total === 0 || item.ratio < 0.85)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  return {
    namaSekolah: settings?.nama_sekolah ?? "Sekolah",
    today,
    todayLabel: formatTanggal(today),
    totalEkskul: ekskul.length,
    totalSiswa: siswaRes.count ?? 0,
    todaySessions,
    trend,
    attention,
    hadir30,
    total30,
    coverage: { tercatat: recordedDates.size, terjadwal },
    pendingJobs: jobsRes.count ?? 0,
    retentionCount: lulusRes.count ?? 0,
    activeTA: activeTA?.nama ?? null,
  };
}

export interface PicEkskulCard {
  id: string;
  nama: string;
  hari: number[];
  jadwalLabel: string;
  lastDate: string | null;
  lastHadir: number;
  lastTotal: number;
  nextDate: string | null;
  todayScheduled: boolean;
  trend: Array<{ label: string; value: number | null }>;
}

export interface PicDashboardData {
  today: string;
  todayLabel: string;
  cards: PicEkskulCard[];
  pendingJobs: number;
}

export async function getPicDashboard(
  supabase: SupabaseClient,
  profileId: string,
): Promise<PicDashboardData> {
  const settings = await getSettings(supabase);
  const timezone = settings?.timezone ?? "Asia/Jakarta";
  const today = todayISO(timezone);
  const todayHari = isodow(today);

  const { data: links } = await supabase
    .from("ekskul_pic")
    .select("ekskul:ekskul_id(id,nama,is_active,ekskul_jadwal(hari))")
    .eq("profile_id", profileId);

  const ekskul = ((links ?? []) as unknown as Array<{ ekskul: EkskulRow | null }>)
    .map((row) => row.ekskul)
    .filter((e): e is EkskulRow => Boolean(e?.is_active));

  const ids = ekskul.map((e) => e.id);
  const dailyRes = ids.length
    ? await supabase
        .from("attendance_daily")
        .select("ekskul_id,tanggal,total,hadir,izin,sakit,alpha")
        .in("ekskul_id", ids)
        .gte("tanggal", addMonths(today, -6))
        .order("tanggal", { ascending: false })
    : { data: [] as DailyRow[] };

  const daily = (dailyRes.data ?? []) as DailyRow[];
  const byEkskul = new Map<string, DailyRow[]>();
  for (const row of daily) {
    const list = byEkskul.get(row.ekskul_id) ?? [];
    list.push(row);
    byEkskul.set(row.ekskul_id, list);
  }

  const cards: PicEkskulCard[] = ekskul.map((e) => {
    const hari = (e.ekskul_jadwal ?? []).map((j) => j.hari).sort();
    const rows = byEkskul.get(e.id) ?? [];
    const last = rows[0] ?? null;
    const last8 = rows.slice(0, 8).reverse();

    let nextDate: string | null = null;
    let cursor = today;
    for (let i = 0; i < 8; i++) {
      if (hari.includes(isodow(cursor))) {
        nextDate = cursor;
        break;
      }
      cursor = addDays(cursor, 1);
    }

    return {
      id: e.id,
      nama: e.nama,
      hari,
      jadwalLabel: hari.map((h) => labelHari(h)).join(" & ") || "-",
      lastDate: last?.tanggal ?? null,
      lastHadir: last?.hadir ?? 0,
      lastTotal: last?.total ?? 0,
      nextDate,
      todayScheduled: hari.includes(todayHari),
      trend: last8.map((row) => ({
        label: row.tanggal.slice(8, 10),
        value: row.total ? Math.round((row.hadir / row.total) * 100) : null,
      })),
    };
  });

  const { count } = await supabase
    .from("sheet_sync_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed"]);

  return {
    today,
    todayLabel: formatTanggal(today),
    cards,
    pendingJobs: count ?? 0,
  };
}
