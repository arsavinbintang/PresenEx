"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv } from "@/lib/env";
import { normalizeNama, normalizeNis, parseCsv } from "@/lib/utils/csv";
import { sanitizeHex } from "@/lib/utils/format";
import { ASSET_BUCKET, validateImageFile } from "@/lib/utils/asset";
import { todayISO } from "@/lib/utils/tanggal";

async function ensureAdmin() {
  const session = await requireSession();
  if (session.profile.role !== "admin") redirect("/dashboard");
  return session;
}

function back(
  path: string,
  message: string,
  tone: "ok" | "error" = "ok",
  extra?: Record<string, string>,
): never {
  const url = new URL(path, "http://local");
  url.searchParams.set(tone, message);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  redirect(`${url.pathname}${url.search}`);
}

// =========================================================
// EKSKUL
// =========================================================
export async function saveEkskulAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const nama = String(formData.get("nama") ?? "").trim();
  const hari = formData
    .getAll("hari")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
  const picIds = formData
    .getAll("pic")
    .map((value) => String(value))
    .filter(Boolean);
  const primary = String(formData.get("primary") ?? "").trim() || null;

  const { data, error } = await supabase.rpc("save_ekskul", {
    p_id: id,
    p_nama: nama,
    p_hari: hari,
    p_pics: picIds,
    p_primary_pic: primary && picIds.includes(primary) ? primary : picIds[0] ?? null,
  });

  if (error) {
    back("/ekskul", error.message, "error");
  }

  revalidatePath("/ekskul");
  revalidatePath("/dashboard");
  revalidatePath("/absen");
  redirect(`/ekskul/${data}`);
}

export async function toggleEkskulActiveAction(
  formData: FormData,
): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";

  const { error } = await supabase
    .from("ekskul")
    .update({ is_active: active })
    .eq("id", id);

  if (error) back("/ekskul", error.message, "error");
  revalidatePath("/ekskul");
  revalidatePath("/dashboard");
  back("/ekskul", active ? "Ekskul diaktifkan kembali." : "Ekskul diarsipkan.");
}

/**
 * Izin mengelola anggota: admin bebas, PIC hanya untuk ekskul yang ditugaskan
 * kepadanya. Mengembalikan session + client supabase yang sudah dipakai.
 */
async function ensureEkskulAccess(ekskulId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  if (session.profile.role === "admin") return { session, supabase };
  if (!ekskulId) redirect("/ekskul");

  const { data: link } = await supabase
    .from("ekskul_pic")
    .select("ekskul_id")
    .eq("ekskul_id", ekskulId)
    .eq("profile_id", session.profile.id)
    .maybeSingle();

  if (!link) redirect("/ekskul");
  return { session, supabase };
}

export async function deleteEkskulAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: ekskul } = await supabase
    .from("ekskul")
    .select("id,nama")
    .eq("id", id)
    .maybeSingle();
  if (!ekskul) back("/ekskul", "Ekskul tidak ditemukan.", "error");

  const { count } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("ekskul_id", id);

  if ((count ?? 0) > 0) {
    back(
      "/ekskul",
      `${ekskul.nama} punya ${count} absensi tersimpan. Gunakan "Nonaktifkan" agar riwayatnya tetap aman.`,
      "error",
    );
  }

  const { error } = await supabase.from("ekskul").delete().eq("id", id);
  if (error) back("/ekskul", error.message, "error");

  revalidatePath("/ekskul");
  revalidatePath("/dashboard");
  back("/ekskul", `Ekskul ${ekskul.nama} dihapus.`);
}

export async function addMemberAction(formData: FormData): Promise<void> {
  const ekskulId = String(formData.get("ekskul_id") ?? "");
  const { supabase } = await ensureEkskulAccess(ekskulId);
  const studentId = String(formData.get("student_id") ?? "");
  const joinedAt =
    String(formData.get("joined_at") ?? "").trim() || todayISO();

  if (!ekskulId || !studentId) {
    back(`/ekskul/${ekskulId}`, "Pilih siswa dulu.", "error");
  }

  const { error } = await supabase.from("members").insert({
    ekskul_id: ekskulId,
    student_id: studentId,
    joined_at: joinedAt,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Siswa ini sudah menjadi anggota aktif."
      : error.message;
    back(`/ekskul/${ekskulId}`, message, "error");
  }

  revalidatePath(`/ekskul/${ekskulId}`);
  back(`/ekskul/${ekskulId}`, "Anggota ditambahkan.");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const ekskulId = String(formData.get("ekskul_id") ?? "");
  const { supabase } = await ensureEkskulAccess(ekskulId);
  const memberId = String(formData.get("member_id") ?? "");

  const { error } = await supabase
    .from("members")
    .update({ left_at: todayISO() })
    .eq("id", memberId)
    .is("left_at", null);

  if (error) back(`/ekskul/${ekskulId}`, error.message, "error");
  revalidatePath(`/ekskul/${ekskulId}`);
  back(`/ekskul/${ekskulId}`, "Anggota dikeluarkan. Riwayat absensi tetap tersimpan.");
}

// =========================================================
// JURUSAN & KELAS
// =========================================================
/** Baca jumlah kelas satu tingkat dari form (0–20; 0 = tingkat itu tanpa kelas). */
function jumlahKelas(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? "").trim();
  const value = raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    back("/admin/jurusan", "Jumlah kelas tiap tingkat harus 0–20.", "error");
  }
  return value;
}

export async function saveJurusanAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const kode = String(formData.get("kode") ?? "").trim().toUpperCase();
  const nama = String(formData.get("nama") ?? "").trim();
  const jumlah10 = jumlahKelas(formData, "jumlah_kelas_10");
  const jumlah11 = jumlahKelas(formData, "jumlah_kelas_11");
  const jumlah12 = jumlahKelas(formData, "jumlah_kelas_12");
  const active = String(formData.get("is_active") ?? "") === "1";

  if (!kode || !nama) {
    back("/admin/jurusan", "Kode dan nama jurusan wajib diisi.", "error");
  }

  const payload = {
    kode,
    nama,
    jumlah_kelas_10: jumlah10,
    jumlah_kelas_11: jumlah11,
    jumlah_kelas_12: jumlah12,
    is_active: active,
  };

  const { error } = id
    ? await supabase.from("jurusan").update(payload).eq("id", id)
    : await supabase.from("jurusan").insert(payload);

  if (error) {
    const message = error.code === "23505"
      ? `Kode jurusan ${kode} sudah dipakai.`
      : error.message.includes("check")
        ? "Jumlah kelas tiap tingkat harus 0–20."
        : error.message;
    back("/admin/jurusan", message, "error");
  }

  revalidatePath("/admin/jurusan");
  revalidatePath("/admin/kelas");
  back(
    "/admin/jurusan",
    id
      ? `Jurusan diperbarui (X ${jumlah10} · XI ${jumlah11} · XII ${jumlah12} kelas).`
      : "Jurusan ditambahkan.",
  );
}

export async function deleteJurusanAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: jurusan } = await supabase
    .from("jurusan")
    .select("id,kode")
    .eq("id", id)
    .maybeSingle();
  if (!jurusan) back("/admin/jurusan", "Jurusan tidak ditemukan.", "error");

  const { data: kelasRows } = await supabase
    .from("kelas")
    .select("id")
    .eq("jurusan_id", id);
  const kelasIds = (kelasRows ?? []).map((row) => row.id);

  if (kelasIds.length > 0) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("kelas_id", kelasIds);
    if ((count ?? 0) > 0) {
      back(
        "/admin/jurusan",
        `Masih ada ${count} siswa pada kelas jurusan ini. Kosongkan kelasnya dulu.`,
        "error",
      );
    }
  }

  const { error } = await supabase.from("jurusan").delete().eq("id", id);
  if (error) back("/admin/jurusan", error.message, "error");

  revalidatePath("/admin/jurusan");
  revalidatePath("/admin/kelas");
  back("/admin/jurusan", `Jurusan ${jurusan.kode} dihapus.`);
}

export async function generateKelasAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const ta = String(formData.get("tahun_ajaran_id") ?? "");

  const { data, error } = await supabase.rpc("generate_kelas", {
    p_tahun_ajaran: ta,
  });

  if (error) back("/admin/kelas", error.message, "error");
  revalidatePath("/admin/kelas");
  back(
    "/admin/kelas",
    (data ?? 0) > 0
      ? `${data} kelas baru dibuat sesuai jumlah kelas tiap jurusan.`
      : "Tidak ada kelas baru — semua kombinasi jurusan × tingkat × nomor sudah ada.",
  );
}

export async function addKelasAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const ta = String(formData.get("tahun_ajaran_id") ?? "");
  const jurusan = String(formData.get("jurusan_id") ?? "");
  const tingkat = Number(formData.get("tingkat") ?? 0);
  const nomor = Number(formData.get("nomor") ?? 0);

  if (!ta || !jurusan || ![10, 11, 12].includes(tingkat) || nomor < 1) {
    back("/admin/kelas", "Data kelas tidak lengkap.", "error");
  }

  const { error } = await supabase.from("kelas").insert({
    tahun_ajaran_id: ta,
    jurusan_id: jurusan,
    tingkat,
    nomor,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Kelas dengan kombinasi itu sudah ada."
      : error.message;
    back("/admin/kelas", message, "error");
  }

  revalidatePath("/admin/kelas");
  back("/admin/kelas", "Kelas ditambahkan.");
}

export async function deleteKelasAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const ta = String(formData.get("ta") ?? "");

  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("kelas_id", id);

  if ((count ?? 0) > 0) {
    back(
      `/admin/kelas${ta ? `?ta=${encodeURIComponent(ta)}` : ""}`,
      `Kelas ini masih diisi ${count} siswa. Pindahkan siswa tersebut terlebih dahulu.`,
      "error",
    );
  }

  const { error } = await supabase.from("kelas").delete().eq("id", id);
  if (error) back(`/admin/kelas`, error.message, "error");

  revalidatePath("/admin/kelas");
  revalidatePath("/admin/siswa");
  back(`/admin/kelas${ta ? `?ta=${encodeURIComponent(ta)}` : ""}`, "Kelas dihapus.");
}

// =========================================================
// SISWA
// =========================================================
function mapSiswaError(message: string): string {
  if (message.includes("students_nis_global")) {
    return "NIS tersebut sudah dipakai siswa aktif lain.";
  }
  if (message.includes("students_nama_fallback")) {
    return "Nama yang sama sudah ada di kelas ini (tanpa NIS).";
  }
  return message;
}

export async function saveSiswaAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const nama = String(formData.get("nama") ?? "").trim();
  const nis = String(formData.get("nis") ?? "").trim() || null;
  const kelasId = String(formData.get("kelas_id") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "aktif");

  if (!nama) back("/admin/siswa", "Nama wajib diisi.", "error");

  const payload = {
    nama,
    nis,
    kelas_id: kelasId,
    status,
    lulus_at:
      status === "lulus" ? todayISO() : null,
  };

  const { error } = id
    ? await supabase.from("students").update(payload).eq("id", id)
    : await supabase.from("students").insert(payload);

  if (error) back("/admin/siswa", mapSiswaError(error.message), "error");

  revalidatePath("/admin/siswa");
  revalidatePath("/dashboard");
  back("/admin/siswa", id ? "Data siswa diperbarui." : "Siswa ditambahkan.");
}

export async function deleteSiswaAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const q = String(formData.get("q") ?? "").trim();

  const { data: siswa } = await supabase
    .from("students")
    .select("id,nama,status")
    .eq("id", id)
    .maybeSingle();
  if (!siswa) back("/admin/siswa", "Siswa tidak ditemukan.", "error");

  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) back("/admin/siswa", error.message, "error");

  revalidatePath("/admin/siswa");
  revalidatePath("/dashboard");
  back(
    "/admin/siswa",
    `Data ${siswa.nama} beserta riwayat absensinya dihapus.`,
    "ok",
    q ? { q } : undefined,
  );
}

export interface ImportState {
  ok?: boolean;
  message?: string;
  added?: number;
  updated?: number;
  skipped?: number;
  conflicts?: string[];
}

export async function importSiswaAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await ensureAdmin();
  const supabase = await createClient();

  const file = formData.get("file");
  const taId = String(formData.get("tahun_ajaran_id") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pilih file CSV terlebih dahulu." };
  }
  if (file.size > 2_000_000) {
    return { ok: false, message: "Ukuran file maksimal 2 MB." };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { ok: false, message: "CSV kosong atau hanya berisi header." };
  }

  const header = rows[0].map((cell) => cell.toLowerCase().trim());
  const index = (name: string) => header.indexOf(name);
  const iNama = index("nama");
  const iNis = index("nis");
  const iJurusan = index("jurusan");
  const iTingkat = index("tingkat");
  const iNomor = index("nomor_kelas");

  if (iNama < 0 || iJurusan < 0 || iTingkat < 0 || iNomor < 0) {
    return {
      ok: false,
      message:
        "Header wajib: nama, nis, jurusan, tingkat, nomor_kelas (pisahkan koma).",
    };
  }

  const { data: jurusanRows } = await supabase
    .from("jurusan")
    .select("id,kode,is_active");
  const jurusanMap = new Map(
    ((jurusanRows ?? []) as Array<{ id: string; kode: string }>).map((j) => [
      j.kode.toUpperCase(),
      j.id,
    ]),
  );

  let ta = taId;
  if (!ta) {
    const { data: active } = await supabase
      .from("tahun_ajaran")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    ta = active?.id ?? "";
  }
  if (!ta) {
    return { ok: false, message: "Belum ada tahun ajaran aktif." };
  }

  const { data: kelasRows } = await supabase
    .from("kelas")
    .select("id,jurusan_id,tingkat,nomor")
    .eq("tahun_ajaran_id", ta);

  const kelasMap = new Map<string, string>();
  for (const row of (kelasRows ?? []) as Array<{
    id: string;
    jurusan_id: string;
    tingkat: number;
    nomor: number;
  }>) {
    kelasMap.set(`${row.jurusan_id}|${row.tingkat}|${row.nomor}`, row.id);
  }

  const { data: studentRows } = await supabase
    .from("students")
    .select("id,nama,nis,kelas_id,status")
    .eq("status", "aktif");

  const students = (studentRows ?? []) as Array<{
    id: string;
    nama: string;
    nis: string | null;
    kelas_id: string | null;
    status: string;
  }>;

  const byNis = new Map<string, (typeof students)[number]>();
  const byName = new Map<string, (typeof students)[number]>();
  for (const student of students) {
    const nisNorm = normalizeNis(student.nis);
    if (nisNorm) byNis.set(nisNorm, student);
    byName.set(
      `${student.kelas_id ?? ""}|${normalizeNama(student.nama)}`,
      student,
    );
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nama = (row[iNama] ?? "").trim();
    const nis = iNis >= 0 ? (row[iNis] ?? "").trim() : "";
    const jurusanKode = (row[iJurusan] ?? "").trim().toUpperCase();
    const tingkat = Number(row[iTingkat] ?? 0);
    const nomor = Number(row[iNomor] ?? 0);

    if (!nama) {
      skipped += 1;
      continue;
    }

    const jurusanId = jurusanMap.get(jurusanKode);
    if (!jurusanId) {
      conflicts.push(`Baris ${i + 1}: jurusan "${jurusanKode}" tidak ditemukan.`);
      skipped += 1;
      continue;
    }

    const kelasId = kelasMap.get(`${jurusanId}|${tingkat}|${nomor}`);
    if (!kelasId) {
      conflicts.push(
        `Baris ${i + 1}: kelas ${jurusanKode} ${tingkat} nomor ${nomor} tidak ada.`,
      );
      skipped += 1;
      continue;
    }

    const nisNorm = normalizeNis(nis);
    const existing = nisNorm
      ? byNis.get(nisNorm)
      : byName.get(`${kelasId}|${normalizeNama(nama)}`);

    if (existing) {
      const { error } = await supabase
        .from("students")
        .update({ nama, nis: nis || null, kelas_id: kelasId })
        .eq("id", existing.id);
      if (error) {
        conflicts.push(`Baris ${i + 1}: ${mapSiswaError(error.message)}`);
        skipped += 1;
      } else {
        updated += 1;
      }
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("students")
      .insert({ nama, nis: nis || null, kelas_id: kelasId })
      .select("id,nama,nis,kelas_id,status")
      .maybeSingle();

    if (error) {
      conflicts.push(`Baris ${i + 1}: ${mapSiswaError(error.message)}`);
      skipped += 1;
      continue;
    }

    added += 1;
    if (inserted) {
      const student = inserted as (typeof students)[number];
      if (nisNorm) byNis.set(nisNorm, student);
      byName.set(`${kelasId}|${normalizeNama(nama)}`, student);
    }
  }

  revalidatePath("/admin/siswa");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Selesai: ${added} baru, ${updated} diperbarui, ${skipped} dilewati.`,
    added,
    updated,
    skipped,
    conflicts: conflicts.slice(0, 30),
  };
}

// =========================================================
// TAHUN AJARAN
// =========================================================
export async function saveTahunAjaranAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const nama = String(formData.get("nama") ?? "").trim();
  const mulai = String(formData.get("mulai") ?? "");
  const selesai = String(formData.get("selesai") ?? "");

  if (!nama || !mulai || !selesai || selesai <= mulai) {
    back("/admin/tahun-ajaran", "Rentang tahun ajaran tidak valid.", "error");
  }

  if (id) {
    const { error } = await supabase
      .from("tahun_ajaran")
      .update({ nama, mulai, selesai })
      .eq("id", id);
    if (error) {
      back(
        "/admin/tahun-ajaran",
        error.code === "23505" ? "Nama tahun ajaran sudah ada." : error.message,
        "error",
      );
    }
    revalidatePath("/admin/tahun-ajaran");
    revalidatePath("/dashboard");
    back("/admin/tahun-ajaran", "Tahun ajaran diperbarui.");
  }

  const { count } = await supabase
    .from("tahun_ajaran")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("tahun_ajaran").insert({
    nama,
    mulai,
    selesai,
    is_active: (count ?? 0) === 0,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Nama tahun ajaran sudah ada."
      : error.message;
    back("/admin/tahun-ajaran", message, "error");
  }

  revalidatePath("/admin/tahun-ajaran");
  back("/admin/tahun-ajaran", "Tahun ajaran dibuat.");
}

export async function deleteTahunAjaranAction(
  formData: FormData,
): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id,nama,is_active")
    .eq("id", id)
    .maybeSingle();

  if (!ta) back("/admin/tahun-ajaran", "Tahun ajaran tidak ditemukan.", "error");
  if (ta.is_active) {
    back(
      "/admin/tahun-ajaran",
      "Tahun ajaran ini sedang aktif. Aktifkan tahun ajaran lain sebelum menghapusnya.",
      "error",
    );
  }

  const { data: kelasRows } = await supabase
    .from("kelas")
    .select("id")
    .eq("tahun_ajaran_id", id);
  const kelasIds = (kelasRows ?? []).map((row) => row.id);

  if (kelasIds.length > 0) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("status", "aktif")
      .in("kelas_id", kelasIds);

    if ((count ?? 0) > 0) {
      back(
        "/admin/tahun-ajaran",
        `Masih ada ${count} siswa aktif di kelas tahun ajaran ini. Pindahkan atau luluskan siswa tersebut dulu.`,
        "error",
      );
    }
  }

  const { error } = await supabase
    .from("tahun_ajaran")
    .delete()
    .eq("id", id);

  if (error) back("/admin/tahun-ajaran", error.message, "error");

  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/admin/kelas");
  revalidatePath("/admin/siswa");
  back("/admin/tahun-ajaran", `Tahun ajaran ${ta.nama} dihapus.`);
}


export async function activateTahunAjaranAction(
  formData: FormData,
): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  await supabase.from("tahun_ajaran").update({ is_active: false }).neq("id", id);
  const { error } = await supabase
    .from("tahun_ajaran")
    .update({ is_active: true })
    .eq("id", id);

  if (error) back("/admin/tahun-ajaran", error.message, "error");
  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/dashboard");
  back("/admin/tahun-ajaran", "Tahun ajaran diaktifkan.");
}

export async function rolloverAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const nama = String(formData.get("nama") ?? "").trim();
  const mulai = String(formData.get("mulai") ?? "");
  const selesai = String(formData.get("selesai") ?? "");
  const salin = String(formData.get("salin") ?? "") === "1";

  const { data, error } = await supabase.rpc("rollover_tahun_ajaran", {
    p_nama: nama,
    p_mulai: mulai,
    p_selesai: selesai,
    p_salin_anggota: salin,
  });

  if (error) {
    const message =
      error.message.includes("NO_ACTIVE_TA")
        ? "Belum ada tahun ajaran aktif."
        : error.message;
    back("/admin/tahun-ajaran", message, "error");
  }

  const result = data as {
    siswa_naik_kelas: number;
    siswa_lulus: number;
    anggota_disalin: number;
  };

  revalidatePath("/admin/tahun-ajaran");
  revalidatePath("/dashboard");
  revalidatePath("/admin/retensi");
  back(
    "/admin/tahun-ajaran",
    `Naik kelas selesai: ${result.siswa_naik_kelas} siswa naik kelas, ${result.siswa_lulus} siswa lulus, ${result.anggota_disalin} anggota ekskul disalin.`,
  );
}

// =========================================================
// PENGGUNA
// =========================================================
export async function createPenggunaAction(formData: FormData): Promise<void> {
  await ensureAdmin();

  if (!hasServiceRoleEnv()) {
    back("/admin/pengguna", "SUPABASE_SERVICE_ROLE_KEY belum diisi.", "error");
  }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const nama = String(formData.get("nama") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "pic");

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    back("/admin/pengguna", "Username tidak valid.", "error");
  }
  if (password.length < 6) {
    back("/admin/pengguna", "Password minimal 6 karakter.", "error");
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@presenex.local`,
      password,
      email_confirm: true,
      user_metadata: { username, nama, role },
      app_metadata: { role },
    });

    if (error) {
      back(
        "/admin/pengguna",
        error.message.includes("already")
          ? "Username sudah dipakai."
          : error.message,
        "error",
      );
    }

    if (data.user) {
      await admin.from("profiles").upsert({
        id: data.user.id,
        username,
        nama,
        role,
        is_active: true,
      });
    }
  } catch (err) {
    back(
      "/admin/pengguna",
      err instanceof Error ? err.message : "Gagal membuat akun.",
      "error",
    );
  }

  revalidatePath("/admin/pengguna");
  back("/admin/pengguna", `Akun ${username} dibuat.`);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    back("/admin/pengguna", "Password minimal 6 karakter.", "error");
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) back("/admin/pengguna", error.message, "error");
  } catch (err) {
    back(
      "/admin/pengguna",
      err instanceof Error ? err.message : "Gagal reset password.",
      "error",
    );
  }

  back("/admin/pengguna", "Password diperbarui.");
}

export async function togglePenggunaAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id);

  if (error) back("/admin/pengguna", error.message, "error");
  revalidatePath("/admin/pengguna");
  back("/admin/pengguna", active ? "Akun diaktifkan." : "Akun dinonaktifkan.");
}

export async function updatePenggunaAction(formData: FormData): Promise<void> {
  const session = await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const nama = String(formData.get("nama") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!id || !nama) back("/admin/pengguna", "Nama wajib diisi.", "error");
  if (role !== "admin" && role !== "pic") {
    back("/admin/pengguna", "Peran harus admin atau pic.", "error");
  }

  if (id === session.profile.id && role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      back(
        "/admin/pengguna",
        "Anda admin terakhir. Buat admin lain dulu sebelum menurunkan peran sendiri.",
        "error",
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nama, role })
    .eq("id", id);

  if (error) back("/admin/pengguna", error.message, "error");

  revalidatePath("/admin/pengguna");
  revalidatePath("/ekskul");
  back("/admin/pengguna", "Data pengguna diperbarui.");
}

// =========================================================
// PENGATURAN, SHEETS, RETENSI
// =========================================================
export async function saveSettingsAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const editWindow = Number(formData.get("edit_window_months") ?? 6);
  const purgeAfter = Number(formData.get("purge_after_months") ?? 3);

  const payload: Record<string, unknown> = {
    nama_sekolah: String(formData.get("nama_sekolah") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? "Asia/Jakarta"),
    warna_aksen: sanitizeHex(String(formData.get("warna_aksen") ?? "")),
    tema: ["auto", "light", "dark"].includes(
      String(formData.get("tema") ?? ""),
    )
      ? String(formData.get("tema"))
      : "auto",
    edit_window_months: editWindow,
    purge_after_months: purgeAfter,
    purge_sheets: String(formData.get("purge_sheets") ?? "") === "1",
    label_hadir: String(formData.get("label_hadir") ?? "Hadir"),
    label_izin: String(formData.get("label_izin") ?? "Izin"),
    label_sakit: String(formData.get("label_sakit") ?? "Sakit"),
    label_alpha: String(formData.get("label_alpha") ?? "Alpha"),
    backup_drive_folder_id:
      String(formData.get("backup_drive_folder_id") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (
    editWindow < 1 ||
    editWindow > 24 ||
    purgeAfter < 0 ||
    purgeAfter > 24
  ) {
    back("/admin/pengaturan", "Nilai bulan di luar rentang yang diizinkan.", "error");
  }

  const { error } = await supabase
    .from("app_settings")
    .update(payload)
    .eq("id", true);

  if (error) back("/admin/pengaturan", error.message, "error");

  revalidatePath("/", "layout");
  back("/admin/pengaturan", "Pengaturan disimpan.");
}

export async function saveSheetConfigAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const ta = String(formData.get("tahun_ajaran_id") ?? "");
  const spreadsheetId = String(formData.get("spreadsheet_id") ?? "").trim();
  const active = String(formData.get("is_active") ?? "") === "1";

  if (!ta || !spreadsheetId) {
    back("/admin/sinkronisasi", "Tahun ajaran dan Spreadsheet ID wajib diisi.", "error");
  }

  if (active) {
    await supabase
      .from("sheet_config")
      .update({ is_active: false })
      .eq("is_active", true);
  }

  const { error } = await supabase.from("sheet_config").upsert(
    {
      tahun_ajaran_id: ta,
      spreadsheet_id: spreadsheetId,
      is_active: active,
    },
    { onConflict: "tahun_ajaran_id" },
  );

  if (error) back("/admin/sinkronisasi", error.message, "error");
  revalidatePath("/admin/sinkronisasi");
  back("/admin/sinkronisasi", "Konfigurasi spreadsheet disimpan.");
}

export async function retrySyncAction(): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("sheet_sync_jobs")
    .update({
      status: "pending",
      run_after: new Date().toISOString(),
      last_error: null,
      attempts: 0,
    })
    .in("status", ["failed", "processing"]);

  if (error) back("/admin/sinkronisasi", error.message, "error");

  try {
    const { processPendingJobs } = await import("@/lib/sheets/sync");
    await processPendingJobs(20);
  } catch (err) {
    console.error("manual sync failed", err);
  }

  revalidatePath("/admin/sinkronisasi");
  back("/admin/sinkronisasi", "Job sinkronisasi diantrekan ulang.");
}

export async function purgeNowAction(): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("purge_lulus");
  if (error) back("/admin/retensi", error.message, "error");

  const result = data as { purged: number };
  revalidatePath("/admin/retensi");
  revalidatePath("/dashboard");
  back("/admin/retensi", `${result.purged} siswa dihapus permanen.`);
}

export async function togglePurgeHoldAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const hold = String(formData.get("hold") ?? "") === "1";

  const { error } = await supabase
    .from("students")
    .update({ purge_hold: hold })
    .eq("id", id);

  if (error) back("/admin/retensi", error.message, "error");
  revalidatePath("/admin/retensi");
  back("/admin/retensi", hold ? "Penghapusan ditahan." : "Penahanan dilepas.");
}

export async function rebuildDailyAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const dari = String(formData.get("dari") ?? "");
  const sampai = String(formData.get("sampai") ?? "");

  const { data, error } = await supabase.rpc("render_ulang_ringkasan", {
    p_dari: dari,
    p_sampai: sampai,
  });

  if (error) back("/admin/pengaturan", error.message, "error");
  revalidatePath("/dashboard");
  back("/admin/pengaturan", `${data ?? 0} baris ringkasan dihitung ulang.`);
}

// =========================================================
// BRANDING: LOGO & SPONSOR
// =========================================================
async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  folder: string,
  file: File,
  prefix: string,
): Promise<{ path: string } | { error: string }> {
  const check = validateImageFile(file);
  if (!check.ok) return { error: check.reason ?? "File tidak valid." };

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${folder}/${prefix}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, file, {
      upsert: false,
      cacheControl: "31536000",
      contentType: file.type,
    });

  if (error) return { error: `Gagal mengunggah: ${error.message}` };
  return { path };
}

export async function saveLogoAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    back("/admin/pengaturan", "Pilih file logo terlebih dahulu.", "error");
  }

  const hasil = await uploadImage(supabase, "logo", file, "logo");
  if ("error" in hasil) {
    back("/admin/pengaturan", hasil.error, "error");
  }

  const { data: lama } = await supabase
    .from("app_settings")
    .select("logo_path")
    .eq("id", true)
    .maybeSingle();

  const { error } = await supabase
    .from("app_settings")
    .update({ logo_path: hasil.path, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) back("/admin/pengaturan", error.message, "error");

  if (lama?.logo_path) {
    await supabase.storage.from(ASSET_BUCKET).remove([lama.logo_path]);
  }

  revalidatePath("/", "layout");
  back("/admin/pengaturan", "Logo aplikasi diganti.");
}

export async function removeLogoAction(): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("app_settings")
    .select("logo_path")
    .eq("id", true)
    .maybeSingle();

  const { error } = await supabase
    .from("app_settings")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) back("/admin/pengaturan", error.message, "error");
  if (data?.logo_path) {
    await supabase.storage.from(ASSET_BUCKET).remove([data.logo_path]);
  }

  revalidatePath("/", "layout");
  back("/admin/pengaturan", "Logo dikembalikan ke bawaan.");
}

export async function saveSponsorAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const nama = String(formData.get("nama") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const urutan = Number(formData.get("urutan") ?? 0);
  const file = formData.get("gambar");

  if (!nama) back("/admin/pengaturan", "Nama sponsor wajib diisi.", "error");
  if (url && !/^https?:\/\//i.test(url)) {
    back("/admin/pengaturan", "URL sponsor harus diawali http:// atau https://", "error");
  }

  const kunci = id ?? Date.now().toString();
  let path: string | null = null;

  if (file instanceof File && file.size > 0) {
    const hasil = await uploadImage(supabase, "sponsor", file, kunci);
    if ("error" in hasil) back("/admin/pengaturan", hasil.error, "error");
    path = hasil.path;
  }

  if (id) {
    const payload: Record<string, unknown> = { nama, url, urutan };
    if (path) payload.path = path;
    const { data: lama } = await supabase
      .from("sponsors")
      .select("path")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("sponsors").update(payload).eq("id", id);
    if (error) back("/admin/pengaturan", error.message, "error");

    if (path && lama?.path && lama.path !== path) {
      await supabase.storage.from(ASSET_BUCKET).remove([lama.path]);
    }
  } else {
    if (!path) {
      back("/admin/pengaturan", "Pilih gambar logo sponsor.", "error");
    }
    const { error } = await supabase.from("sponsors").insert({
      nama,
      url,
      urutan,
      path: path,
      is_active: true,
    });
    if (error) back("/admin/pengaturan", error.message, "error");
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/pengaturan");
  revalidatePath("/login");
  back("/admin/pengaturan", id ? "Sponsor diperbarui." : "Sponsor ditambahkan.");
}

export async function toggleSponsorAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";

  const { error } = await supabase
    .from("sponsors")
    .update({ is_active: active })
    .eq("id", id);
  if (error) back("/admin/pengaturan", error.message, "error");

  revalidatePath("/", "layout");
  revalidatePath("/login");
  back(
    "/admin/pengaturan",
    active ? "Sponsor ditampilkan." : "Sponsor disembunyikan.",
  );
}

export async function deleteSponsorAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data } = await supabase
    .from("sponsors")
    .select("id,nama,path")
    .eq("id", id)
    .maybeSingle();
  if (!data) back("/admin/pengaturan", "Sponsor tidak ditemukan.", "error");

  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) back("/admin/pengaturan", error.message, "error");

  await supabase.storage.from(ASSET_BUCKET).remove([data.path]);

  revalidatePath("/", "layout");
  revalidatePath("/login");
  back("/admin/pengaturan", `Sponsor ${data.nama} dihapus.`);
}

export async function deleteSheetConfigAction(
  formData: FormData,
): Promise<void> {
  await ensureAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("sheet_config").delete().eq("id", id);
  if (error) back("/admin/sinkronisasi", error.message, "error");

  revalidatePath("/admin/sinkronisasi");
  back("/admin/sinkronisasi", "Konfigurasi spreadsheet dihapus.");
}
