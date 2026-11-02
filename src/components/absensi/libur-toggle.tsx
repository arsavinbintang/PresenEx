"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLiburAction } from "@/lib/actions/attendance";

export function LiburToggle({
  ekskulId,
  tanggal,
  libur,
}: {
  ekskulId: string;
  tanggal: string;
  libur: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const result = await toggleLiburAction({
        ekskulId,
        tanggal,
        libur: !libur,
      });
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={libur ? "btn btn-ghost btn-sm" : "btn btn-ghost btn-sm"}
        onClick={toggle}
        disabled={pending}
      >
        {libur ? "Batalkan tanda libur" : "Tandai libur"}
      </button>
      {message ? <span className="muted text-right text-xs">{message}</span> : null}
    </div>
  );
}
