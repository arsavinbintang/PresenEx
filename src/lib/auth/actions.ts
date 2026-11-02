"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(32, "Username maksimal 32 karakter.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, minus."),
  password: z.string().min(6, "Password minimal 6 karakter."),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!hasSupabaseEnv()) {
    return {
      error:
        "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${parsed.data.username.toLowerCase()}@presenex.local`,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Username atau password salah." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return {
      error: "Akun ini nonaktif. Hubungi admin untuk mengaktifkan kembali.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
