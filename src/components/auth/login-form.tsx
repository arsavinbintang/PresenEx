"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/lib/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Memeriksa..." : "Masuk"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="contoh: budi.pic"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      {state.error ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--alpha-soft)", color: "var(--alpha)" }}
          aria-live="polite"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="muted text-center text-xs">
        Akun dibuat oleh admin sekolah. Tidak ada pendaftaran mandiri.
      </p>
    </form>
  );
}
