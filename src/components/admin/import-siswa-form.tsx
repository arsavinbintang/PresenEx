"use client";

import { useActionState } from "react";
import {
  importSiswaAction,
  type ImportState,
} from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/feedback";

export function ImportSiswaForm({ tahunAjaranId }: { tahunAjaranId: string }) {
  const [state, action] = useActionState<ImportState, FormData>(
    importSiswaAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tahun_ajaran_id" value={tahunAjaranId} />

      <div>
        <label className="label" htmlFor="file">
          File CSV
        </label>
        <input
          id="file"
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="input !py-1.5 text-sm"
          required
        />
        <p className="muted mt-1 text-xs">
          Header: <code className="font-mono">nama,nis,jurusan,tingkat,nomor_kelas</code>.
          Pemisah koma atau titik koma. NIS boleh kosong.
        </p>
      </div>

      <SubmitButton className="btn btn-primary" pendingText="Mengimpor...">
        Impor siswa
      </SubmitButton>

      {state.message ? (
        <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>
      ) : null}

      {state.conflicts && state.conflicts.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-[var(--surface-2)] p-2 text-xs">
          {state.conflicts.map((item) => (
            <li key={item} className="text-[var(--alpha)]">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
