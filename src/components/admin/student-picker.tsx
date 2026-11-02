"use client";

import { useMemo, useState } from "react";
import { addMemberAction } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";
import { Icon } from "@/components/ui/icons";

export interface PickableStudent {
  id: string;
  nama: string;
  nis: string | null;
  kelas: string;
}

export function StudentPicker({
  ekskulId,
  students,
  today,
}: {
  ekskulId: string;
  students: PickableStudent[];
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 40);
    return students
      .filter(
        (student) =>
          student.nama.toLowerCase().includes(q) ||
          (student.nis ?? "").toLowerCase().includes(q) ||
          student.kelas.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [query, students]);

  const chosen = students.find((student) => student.id === selected) ?? null;

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
            placeholder="Nama, NIS, atau kelas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border">
        {filtered.length === 0 ? (
          <p className="muted px-3 py-4 text-sm">
            Tidak ada siswa yang cocok. Semua siswa mungkin sudah menjadi
            anggota.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((student) => {
              const active = student.id === selected;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(student.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                    style={
                      active
                        ? { background: "var(--accent-soft)", color: "var(--accent)" }
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
          className="btn btn-primary"
          pendingText="Menambahkan..."
        >
          Tambah anggota
        </SubmitButton>
      </div>

      <p className="muted text-xs">
        {chosen
          ? `Dipilih: ${chosen.nama} (${chosen.kelas})`
          : `${students.length} siswa aktif belum menjadi anggota.`}
      </p>
    </form>
  );
}
