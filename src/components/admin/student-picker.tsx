"use client";

import { useEffect, useRef, useState } from "react";
import { addMemberAction } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { Icon } from "@/components/ui/icons";

export interface PickableStudent {
  id: string;
  nama: string;
  nis: string | null;
  kelas: string;
}

/**
 * Pemilih anggota berbasis pencarian server.
 * Tidak ada daftar siswa yang disimpan di browser — cukup ketik minimal
 * 1 huruf, hasil maksimal 20 siswa dimuat lewat /api/students/search.
 */
export function StudentPicker({
  ekskulId,
  today,
}: {
  ekskulId: string;
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickableStudent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  // Bersihkan pencarian yang masih menerbangkan request saat komponen dilepas.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  async function cari(q: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/students/search?ekskul_id=${encodeURIComponent(ekskulId)}&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      );
      const data = (await res.json()) as {
        ok: boolean;
        results?: PickableStudent[];
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setResults([]);
        setNote(data.message ?? "Pencarian gagal. Coba lagi.");
        return;
      }
      const list = data.results ?? [];
      setResults(list);
      setSelected((prev) =>
        prev && list.some((item) => item.id === prev) ? prev : null,
      );
      setNote(
        list.length === 0
          ? "Tidak ada siswa yang cocok (atau semuanya sudah anggota)."
          : null,
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setNote("Koneksi bermasalah. Coba lagi.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  /** Dijalankan dari input: jeda 250 ms sebelum memanggil server. */
  function ubahQuery(value: string) {
    setQuery(value);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const q = value.trim();
    if (q.length < 1) {
      setResults([]);
      setSelected(null);
      setLoading(false);
      setNote(null);
      return;
    }

    setLoading(true);
    setNote(null);
    timerRef.current = window.setTimeout(() => {
      void cari(q);
    }, 250);
  }

  const chosen = results.find((student) => student.id === selected) ?? null;

  return (
    <form action={addMemberAction} className="space-y-3">
      <input type="hidden" name="ekskul_id" value={ekskulId} />
      {selected ? (
        <input type="hidden" name="student_id" value={selected} />
      ) : null}

      <div>
        <label className="label" htmlFor="cari-siswa">
          Cari siswa
        </label>
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            id="cari-siswa"
            className="input pl-9"
            placeholder="Ketik nama, NIS, atau kelas…"
            value={query}
            onChange={(event) => ubahQuery(event.target.value)}
            autoComplete="off"
            type="search"
            enterKeyHint="search"
          />
        </div>
        <p className="muted mt-1 text-xs">
          Ketik minimal 1 huruf. Maksimal 20 hasil ditampilkan.
        </p>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border">
        {loading ? (
          <p className="muted px-3 py-4 text-sm">Mencari siswa…</p>
        ) : results.length === 0 ? (
          <p className="muted px-3 py-4 text-sm">
            {note ??
              (query.trim()
                ? "Tidak ada siswa yang cocok."
                : "Mulai mengetik untuk mencari siswa.")}
          </p>
        ) : (
          <ul className="divide-y">
            {results.map((student) => {
              const active = student.id === selected;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(student.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
                    style={
                      active
                        ? {
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }
                        : undefined
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {student.nama}
                      </span>
                      <span className="muted block truncate text-xs">
                        {student.kelas}
                        {student.nis ? ` · ${student.nis}` : ""}
                      </span>
                    </span>
                    {active ? (
                      <Icon name="check" className="h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="joined_at">
            Tanggal bergabung
          </label>
          <input
            id="joined_at"
            type="date"
            name="joined_at"
            defaultValue={today}
            max={today}
            className="input"
          />
        </div>
        <SubmitButton
          className="btn btn-primary flex-1 sm:flex-none"
          pendingText="Menambahkan..."
          disabled={!selected}
        >
          Tambah anggota
        </SubmitButton>
      </div>

      <p className="muted text-xs">
        {chosen
          ? `Dipilih: ${chosen.nama} (${chosen.kelas})`
          : "Pilih satu siswa dari hasil pencarian terlebih dahulu."}
      </p>
    </form>
  );
}
