import { NextResponse } from "next/server";
import { CRON_SECRET, hasServiceRoleEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingJobs } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  if (!CRON_SECRET) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${CRON_SECRET}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === CRON_SECRET;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum diisi." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const result: Record<string, unknown> = {};

  try {
    result.sync = await processPendingJobs(50);
  } catch (err) {
    result.sync = {
      error: err instanceof Error ? err.message : "Gagal memproses antrean.",
    };
  }

  try {
    const { data, error } = await admin.rpc("purge_lulus");
    result.purge = error ? { error: error.message } : data;
  } catch (err) {
    result.purge = {
      error: err instanceof Error ? err.message : "Gagal menjalankan retensi.",
    };
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result });
}
