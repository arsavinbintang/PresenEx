"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/db";

export interface AttendanceEntryInput {
  member_id: string;
  status: AttendanceStatus;
  catatan?: string;
}

export interface SaveAttendanceResult {
  ok: boolean;
  message: string;
  summary?: {
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    total: number;
  };
}

const MESSAGES: Record<string, string> = {
  FORBIDDEN: "Akun ini tidak punya akses ke ekskul tersebut.",
  DATE_REQUIRED: "Tanggal sesi wajib diisi.",
  FUTURE_DATE: "Tanggal tidak boleh melewati hari ini.",
  EDIT_WINDOW_CLOSED:
    "Batas koreksi sudah terlewati. Hubungi admin untuk mengubah sesi ini.",
  OUTSIDE_EDIT_WINDOW:
    "Batas koreksi sudah terlewati. Hubungi admin untuk mengubah sesi ini.",
  INVALID_ENTRIES: "Data absensi tidak valid.",
  EMPTY_ROSTER: "Belum ada anggota aktif pada tanggal ini.",
  ROSTER_INCOMPLETE:
    "Semua anggota pada tanggal ini harus diisi. Muat ulang halaman lalu coba lagi.",
  INVALID_MEMBER: "Ada anggota yang bukan bagian dari ekskul ini.",
  INVALID_STATUS: "Status absensi tidak dikenal.",
};

function describeError(message: string | undefined): string {
  if (!message) return "Gagal menyimpan absensi. Coba lagi.";
  for (const key of Object.keys(MESSAGES)) {
    if (message.includes(key)) return MESSAGES[key];
  }
  return message;
}

export async function saveAttendanceAction(input: {
  ekskulId: string;
  tanggal: string;
  entries: AttendanceEntryInput[];
}): Promise<SaveAttendanceResult> {
  const session = await requireSession();
  const supabase = await createClient();

  let allowed = session.profile.role === "admin";
  if (!allowed) {
    const { data } = await supabase
      .from("ekskul_pic")
      .select("ekskul_id")
      .eq("ekskul_id", input.ekskulId)
      .eq("profile_id", session.profile.id)
      .maybeSingle();
    allowed = Boolean(data);
  }

  if (!allowed) {
    return { ok: false, message: MESSAGES.FORBIDDEN };
  }

  const entries = input.entries.map((entry) => ({
    member_id: entry.member_id,
    status: entry.status,
    catatan: entry.catatan?.slice(0, 200) ?? null,
  }));

  const { data, error } = await supabase.rpc("save_attendance", {
    p_ekskul: input.ekskulId,
    p_tanggal: input.tanggal,
    p_items: entries,
  });

  if (error) {
    return { ok: false, message: describeError(error.message) };
  }

  revalidatePath(`/absen/${input.ekskulId}`);
  revalidatePath("/dashboard");
  revalidatePath("/laporan");
  revalidatePath(`/ekskul/${input.ekskulId}`);

  after(async () => {
    try {
      const { syncSession } = await import("@/lib/sheets/sync");
      await syncSession(input.ekskulId, input.tanggal);
    } catch (err) {
      console.error("sync after save failed", err);
    }
  });

  const summary = data as {
    total: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
  };

  return {
    ok: true,
    message: "Absensi tersimpan.",
    summary: {
      hadir: summary.hadir,
      izin: summary.izin,
      sakit: summary.sakit,
      alpha: summary.alpha,
      total: summary.total,
    },
  };
}

export async function toggleLiburAction(input: {
  ekskulId: string;
  tanggal: string;
  libur: boolean;
}): Promise<SaveAttendanceResult> {
  const session = await requireSession();
  const supabase = await createClient();

  let allowed = session.profile.role === "admin";
  if (!allowed) {
    const { data } = await supabase
      .from("ekskul_pic")
      .select("ekskul_id")
      .eq("ekskul_id", input.ekskulId)
      .eq("profile_id", session.profile.id)
      .maybeSingle();
    allowed = Boolean(data);
  }

  if (!allowed) return { ok: false, message: MESSAGES.FORBIDDEN };

  if (input.libur) {
    const { error } = await supabase.from("sesi_libur").upsert({
      ekskul_id: input.ekskulId,
      tanggal: input.tanggal,
      keterangan: "Ditandai dari halaman absensi",
    });
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("sesi_libur")
      .delete()
      .eq("ekskul_id", input.ekskulId)
      .eq("tanggal", input.tanggal);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/absen/${input.ekskulId}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: input.libur
      ? "Sesi ditandai libur dan tidak dihitung sebagai sesi terjadwal."
      : "Tanda libur dihapus.",
  };
}
