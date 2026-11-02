import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  hasServiceRoleEnv,
} from "@/lib/env";

export function createAdminClient() {
  if (!hasServiceRoleEnv()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
