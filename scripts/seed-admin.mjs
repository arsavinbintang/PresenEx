#!/usr/bin/env node
/**
 * Membuat akun admin pertama.
 *
 * Pemakaian:
 *   npm run seed:admin
 *
 * Variabel yang dibaca dari .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_ADMIN_USERNAME (default: admin)
 *   SEED_ADMIN_PASSWORD (wajib)
 *   SEED_ADMIN_NAMA (default: Administrator)
 *
 * Skrip aman dijalankan berulang: jika username sudah ada, password dan
 * profil admin diperbarui.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = (process.env.SEED_ADMIN_USERNAME ?? "admin")
  .trim()
  .toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? "";
const nama = process.env.SEED_ADMIN_NAMA ?? "Administrator";

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local.",
  );
  process.exit(1);
}

if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("SEED_ADMIN_USERNAME tidak valid (3-32 huruf/angka/titik/minus).");
  process.exit(1);
}

if (password.length < 6) {
  console.error("SEED_ADMIN_PASSWORD minimal 6 karakter.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `${username}@presenex.local`;

async function main() {
  const { data: existing, error: findError } = await admin
    .from("profiles")
    .select("id")
    .eq("username_norm", username)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata: { username, nama, role: "admin" },
        app_metadata: { role: "admin" },
      },
    );
    if (authError) throw authError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ nama, role: "admin", is_active: true })
      .eq("id", existing.id);
    if (profileError) throw profileError;

    console.log(`Akun admin @${username} sudah ada. Password diperbarui.`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, nama, role: "admin" },
    app_metadata: { role: "admin" },
  });

  if (error) throw error;
  if (!data.user) throw new Error("Supabase tidak mengembalikan user.");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    username,
    nama,
    role: "admin",
    is_active: true,
  });

  if (profileError) throw profileError;

  console.log(`Akun admin @${username} dibuat. Login dengan username + password.`);
}

main().catch((error) => {
  console.error("Gagal membuat admin:", error.message ?? error);
  process.exit(1);
});
