"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAttendanceAction,
  type AttendanceEntryInput,
} from "@/lib/actions/attendance";
import type { AttendanceStatus } from "@/types/db";
import type { RosterItem } from "@/lib/queries/absensi";
import { cn } from "@/lib/utils/format";
import { Icon } from "@/components/ui/icons";

const STATUS_ORDER: AttendanceStatus[] = ["hadir", "izin", "sakit", "alpha"];

const STATUS_COLOR: Record<
  AttendanceStatus,
  { color: string; soft: string }
> = {
  hadir: { color: "var(--hadir)", soft: "var(--hadir-soft)" },
  izin: { color: "var(--izin)", soft: "var(--izin-soft)" },
  sakit: { color: "var(--sakit)", soft: "var(--sakit-soft)" },
  alpha: { color: "var(--alpha)", soft: "var(--alpha-soft)" },
};

interface DraftEntry {
  status: AttendanceStatus;
  catatan: string;
}

export function AttendanceForm({
  ekskulId,
  tanggal,
  roster,
  canEdit,
  labels,
  isScheduled,
}: {
  ekskulId: string;
  tanggal: string;
  roster: RosterItem[];
  canEdit: boolean;
  labels: Record<AttendanceStatus, string>;
  isScheduled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, DraftEntry>>(() => {
    const initial: Record<string, DraftEntry> = {};
    for (const item of roster) {
      initial[item.memberId] = { status: item.status, catatan: item.catatan };
    }
    return initial;
  });
  const [openNote, setOpenNote] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpha: 0,
    };
    for (const item of roster) {
      const status = draft[item.memberId]?.status ?? "hadir";
      result[status] += 1;
    }
    return result;
  }, [draft, roster]);

  function setStatus(memberId: string, status: AttendanceStatus) {
    setDraft((prev) => ({
      ...prev,
      [memberId]: { status, catatan: prev[memberId]?.catatan ?? "" },
    }));
  }

  function setNote(memberId: string, catatan: string) {
    setDraft((prev) => ({
      ...prev,
      [memberId]: {
        status: prev[memberId]?.status ?? "hadir",
        catatan,
      },
    }));
  }

  function allHadir() {
    const next: Record<string, DraftEntry> = {};
    for (const item of roster) {
      next[item.memberId] = {
        status: "hadir",
        catatan: draft[item.memberId]?.catatan ?? "",
      };
    }
    setDraft(next);
  }

  function save() {
    setMessage(null);
    const entries: AttendanceEntryInput[] = roster.map((item) => ({
      member_id: item.memberId,
      status: draft[item.memberId]?.status ?? "hadir",
      catatan: draft[item.memberId]?.catatan || undefined,
    }));

    startTransition(async () => {
      const result = await saveAttendanceAction({
        ekskulId,
        tanggal,
        entries,
      });
      if (result.ok && result.summary) {
        const s = result.summary;
        setMessage({
          tone: "ok",
          text: `Tersimpan · ${s.hadir} hadir, ${s.izin} izin, ${s.sakit} sakit, ${s.alpha} alpha. Backup Sheets masuk antrean.`,
        });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  if (roster.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="font-semibold">Belum ada anggota</p>
        <p className="muted mt-1 text-sm">
          Tambahkan anggota ekskul terlebih dahulu dari halaman detail ekskul.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!isScheduled ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--sakit-soft)", color: "var(--sakit)" }}
        >
          Tanggal ini bukan hari jadwal ekskul. Tetap simpan sebagai sesi
          susulan?
        </div>
      ) : null}

      {!canEdit ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--alpha-soft)", color: "var(--alpha)" }}
        >
          Sesi ini di luar batas koreksi. Hanya admin yang dapat mengubahnya.
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={allHadir}
          disabled={!canEdit}
        >
          <Icon name="check" className="h-4 w-4" />
          Semua hadir
        </button>
        <span className="muted text-xs">
          {roster.length} anggota · {counts.hadir} hadir
        </span>
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y">
          {roster.map((item, index) => {
            const entry = draft[item.memberId] ?? {
              status: "hadir" as AttendanceStatus,
              catatan: "",
            };
            return (
              <li key={item.memberId} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <span className="muted mr-1.5 text-xs tabular-nums">
                        {index + 1}.
                      </span>
                      {item.nama}
                    </p>
                    <p className="muted text-xs">
                      {item.kelas}
                      {item.nis ? ` · ${item.nis}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    {STATUS_ORDER.map((status) => {
                      const active = entry.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={active}
                          disabled={!canEdit}
                          onClick={() => setStatus(item.memberId, status)}
                          className={cn(
                            "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-bold transition-colors",
                            !canEdit && "opacity-50",
                          )}
                          style={
                            active
                              ? {
                                  background: STATUS_COLOR[status].soft,
                                  color: STATUS_COLOR[status].color,
                                  borderColor: STATUS_COLOR[status].color,
                                }
                              : undefined
                          }
                          title={labels[status]}
                        >
                          {labels[status].slice(0, 1)}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        setOpenNote((prev) => ({
                          ...prev,
                          [item.memberId]: !prev[item.memberId],
                        }))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg border"
                      title="Catatan"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {openNote[item.memberId] || entry.catatan ? (
                  <input
                    className="input mt-2 text-sm"
                    placeholder="Catatan (opsional)"
                    value={entry.catatan}
                    maxLength={200}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setNote(item.memberId, event.target.value)
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {message ? (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-sm"
          style={
            message.tone === "ok"
              ? { background: "var(--hadir-soft)", color: "var(--hadir)" }
              : { background: "var(--alpha-soft)", color: "var(--alpha)" }
          }
          aria-live="polite"
        >
          {message.text}
        </div>
      ) : null}

      <div className="sticky bottom-16 z-10 mt-4 md:bottom-4">
        <div
          className="card flex items-center gap-3 p-3"
          style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.10)" }}
        >
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold">
              {counts.hadir} H · {counts.izin} I · {counts.sakit} S ·{" "}
              {counts.alpha} A
            </p>
            <p className="muted truncate">
              {pending ? "Menyimpan..." : `${roster.length} anggota`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={pending || !canEdit}
          >
            {pending ? "Menyimpan..." : "Simpan absensi"}
          </button>
        </div>
      </div>
    </div>
  );
}
