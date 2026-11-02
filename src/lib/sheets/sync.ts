import { JWT } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv } from "@/lib/env";
import { monthKey } from "@/lib/utils/tanggal";
import { labelKelas } from "@/lib/utils/tanggal";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const HEADER = [
  "Tanggal",
  "Ekskul",
  "NIS",
  "Nama",
  "Kelas",
  "Status",
  "Catatan",
  "Member ID",
];

const LABEL_KEY: Record<string, string> = {
  hadir: "label_hadir",
  izin: "label_izin",
  sakit: "label_sakit",
  alpha: "label_alpha",
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY belum diisi.",
    );
  }
  return { email, key: rawKey.replace(/\\n/g, "\n") };
}

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY,
  );
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const { email, key } = getCredentials();
  const jwt = new JWT({ email, key, scopes: SCOPES });
  const { access_token, expiry_date } = await jwt.authorize();

  if (!access_token) throw new Error("Gagal mendapatkan token Google.");

  tokenCache = {
    token: access_token,
    expiresAt: expiry_date ?? Date.now() + 50 * 60_000,
  };
  return access_token;
}

async function sheetsFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const response = await fetch(`${SHEETS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Sheets API ${response.status}: ${text.slice(0, 400) || response.statusText}`,
    );
  }

  return response;
}

async function ensureSheet(spreadsheetId: string, tab: string): Promise<void> {
  const res = await sheetsFetch(
    `/${spreadsheetId}?fields=sheets.properties.title`,
  );
  const json = (await res.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const exists = (json.sheets ?? []).some(
    (sheet) => sheet.properties?.title === tab,
  );

  if (!exists) {
    await sheetsFetch(`/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: tab } } }],
      }),
    });
  }

  const encoded = encodeURIComponent(tab);
  const headRes = await sheetsFetch(
    `/${spreadsheetId}/values/${encoded}!A1:H1`,
  );
  const head = (await headRes.json()) as { values?: string[][] };
  const current = head.values?.[0] ?? [];

  if (current.join("|") !== HEADER.join("|")) {
    await sheetsFetch(
      `/${spreadsheetId}/values/${encoded}!A1:H1?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [HEADER] }),
      },
    );
  }
}

interface SyncResult {
  skipped: boolean;
  rows: number;
}

export async function syncSession(
  ekskulId: string,
  tanggal: string,
): Promise<SyncResult> {
  if (!hasServiceRoleEnv() || !isSheetsConfigured()) {
    return { skipped: true, rows: 0 };
  }

  const admin = createAdminClient();

  const { data: config } = await admin
    .from("sheet_config")
    .select("spreadsheet_id")
    .eq("is_active", true)
    .maybeSingle();

  const spreadsheetId =
    config?.spreadsheet_id || process.env.GOOGLE_SHEET_ID || "";

  if (!spreadsheetId) {
    return { skipped: true, rows: 0 };
  }

  const [ekskulRes, settingsRes, attRes] = await Promise.all([
    admin.from("ekskul").select("nama").eq("id", ekskulId).maybeSingle(),
    admin
      .from("app_settings")
      .select("label_hadir,label_izin,label_sakit,label_alpha")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("attendance")
      .select(
        "member_id,status,catatan,student:student_id(nama,nis,kelas_id)",
      )
      .eq("ekskul_id", ekskulId)
      .eq("tanggal", tanggal),
  ]);

  if (ekskulRes.error || attRes.error) {
    throw new Error(
      ekskulRes.error?.message ?? attRes.error?.message ?? "Gagal membaca data.",
    );
  }

  const ekskulNama = (ekskulRes.data as { nama?: string } | null)?.nama ?? "-";
  const settings = settingsRes.data as Record<string, string> | null;
  const labels = (status: string) =>
    settings?.[LABEL_KEY[status] ?? "label_hadir"] ??
    status.charAt(0).toUpperCase() + status.slice(1);

  const kelasIds = new Set<string>();
  const rowsRaw = (
    (attRes.data ?? []) as unknown as Array<{
      member_id: string;
      status: string;
      catatan: string | null;
      student: {
        nama: string;
        nis: string | null;
        kelas_id: string | null;
      } | null;
    }>
  ).filter((row) => {
    if (row.student?.kelas_id) kelasIds.add(row.student.kelas_id);
    return Boolean(row.student);
  });

  let kelasById = new Map<
    string,
    { tingkat: number; nomor: number; jurusan_kode: string }
  >();

  if (kelasIds.size > 0) {
    const { data: kelasRows } = await admin
      .from("kelas")
      .select("id,tingkat,nomor,jurusan:jurusan_id(kode)")
      .in("id", Array.from(kelasIds));
    kelasById = new Map(
      ((kelasRows ?? []) as unknown as Array<{
        id: string;
        tingkat: number;
        nomor: number;
        jurusan: { kode: string } | null;
      }>).map((row) => [
        row.id,
        {
          tingkat: row.tingkat,
          nomor: row.nomor,
          jurusan_kode: row.jurusan?.kode ?? "-",
        },
      ]),
    );
  }

  const newRows = rowsRaw
    .map((row) => {
      const student = row.student!;
      const kelas = student.kelas_id
        ? kelasById.get(student.kelas_id)
        : undefined;
      return [
        tanggal,
        ekskulNama,
        student.nis ?? "",
        student.nama,
        kelas ? labelKelas(kelas) : "-",
        labels(row.status),
        row.catatan ?? "",
        row.member_id,
      ];
    })
    .sort((a, b) => String(a[3]).localeCompare(String(b[3])));

  const tab = `Presensi ${monthKey(tanggal)}`;
  await ensureSheet(spreadsheetId, tab);

  const encoded = encodeURIComponent(tab);
  const existingRes = await sheetsFetch(
    `/${spreadsheetId}/values/${encoded}!A2:H`,
  );
  const existingJson = (await existingRes.json()) as { values?: string[][] };
  const existing = existingJson.values ?? [];

  const kept = existing.filter(
    (row) => !(row[0] === tanggal && row[1] === ekskulNama),
  );

  const merged = [...kept, ...newRows];

  await sheetsFetch(
    `/${spreadsheetId}/values/${encoded}!A2:H:clear`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  if (merged.length > 0) {
    await sheetsFetch(
      `/${spreadsheetId}/values/${encoded}!A2?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: merged }),
      },
    );
  }

  return { skipped: false, rows: newRows.length };
}

interface ClaimedJob {
  id: number;
  ekskul_id: string;
  tanggal: string;
  action: "upsert" | "delete";
  attempts: number;
}

export interface ProcessSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export async function processPendingJobs(
  limit = 20,
): Promise<ProcessSummary> {
  if (!hasServiceRoleEnv()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_sync_jobs", { p_limit: limit });

  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as ClaimedJob[];
  const summary: ProcessSummary = {
    processed: jobs.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of jobs) {
    try {
      const result = await syncSession(job.ekskul_id, job.tanggal);
      if (result.skipped) {
        summary.skipped += 1;
      } else {
        summary.succeeded += 1;
      }

      await admin
        .from("sheet_sync_jobs")
        .update({
          status: "done",
          last_error: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (err) {
      summary.failed += 1;
      const message =
        err instanceof Error ? err.message : "Kesalahan tidak dikenal.";
      const backoffMinutes = Math.min(60, 5 * Math.max(1, job.attempts));

      await admin
        .from("sheet_sync_jobs")
        .update({
          status: "failed",
          last_error: message.slice(0, 900),
          locked_at: null,
          run_after: new Date(
            Date.now() + backoffMinutes * 60_000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return summary;
}
