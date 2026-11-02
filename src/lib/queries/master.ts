import type { SupabaseClient } from "@supabase/supabase-js";
import { labelKelas } from "@/lib/utils/tanggal";
import type { AppSettings, Kelas, TahunAjaran } from "@/types/db";

export interface KelasInfo {
  id: string;
  tingkat: number;
  nomor: number;
  jurusan_kode: string;
  jurusan_nama: string;
  label: string;
}

export async function getSettings(
  supabase: SupabaseClient,
): Promise<AppSettings | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return (data as AppSettings | null) ?? null;
}

export async function getActiveTA(
  supabase: SupabaseClient,
): Promise<TahunAjaran | null> {
  const { data } = await supabase
    .from("tahun_ajaran")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return (data as TahunAjaran | null) ?? null;
}

export async function getKelasMap(
  supabase: SupabaseClient,
): Promise<Map<string, KelasInfo>> {
  const { data } = await supabase
    .from("kelas")
    .select("id,tingkat,nomor,jurusan:jurusan_id(kode,nama)");

  const map = new Map<string, KelasInfo>();
  for (const row of (data ?? []) as unknown as Array<
    Kelas & { jurusan: { kode: string; nama: string } | null }
  >) {
    const kode = row.jurusan?.kode ?? "-";
    map.set(row.id, {
      id: row.id,
      tingkat: row.tingkat,
      nomor: row.nomor,
      jurusan_kode: kode,
      jurusan_nama: row.jurusan?.nama ?? "-",
      label: labelKelas({
        tingkat: row.tingkat,
        jurusan_kode: kode,
        nomor: row.nomor,
      }),
    });
  }
  return map;
}

export interface KelasOption {
  id: string;
  label: string;
  sortKey: string;
}

export async function listKelasOptions(
  supabase: SupabaseClient,
  tahunAjaranId?: string | null,
): Promise<KelasOption[]> {
  let query = supabase
    .from("kelas")
    .select("id,tingkat,nomor,jurusan:jurusan_id(kode,nama)");
  if (tahunAjaranId) query = query.eq("tahun_ajaran_id", tahunAjaranId);

  const { data } = await query;
  return ((data ?? []) as unknown as Array<
    Kelas & { jurusan: { kode: string; nama: string } | null }
  >)
    .map((row) => {
      const kode = row.jurusan?.kode ?? "-";
      return {
        id: row.id,
        label: labelKelas({
          tingkat: row.tingkat,
          jurusan_kode: kode,
          nomor: row.nomor,
        }),
        sortKey: `${row.tingkat}-${kode}-${String(row.nomor).padStart(2, "0")}`,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export async function getPicEkskulIds(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("ekskul_pic")
    .select("ekskul_id")
    .eq("profile_id", profileId);
  return ((data ?? []) as Array<{ ekskul_id: string }>).map(
    (row) => row.ekskul_id,
  );
}

export function canAccessEkskul(
  role: string,
  picIds: string[],
  ekskulId: string,
): boolean {
  return role === "admin" || picIds.includes(ekskulId);
}
