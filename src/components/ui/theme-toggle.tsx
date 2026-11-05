"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";
import type { Tema } from "@/types/db";

const KEY = "presenex.tema";
const EVENT = "presenex:tema-change";

type Mode = "light" | "dark";

const LABEL: Record<Mode, string> = {
  light: "Mode terang",
  dark: "Mode gelap",
};

function bacaTersimpan(): Tema | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") {
      return stored;
    }
  } catch {
    /* private mode: abaikan */
  }
  const bawaan = document.documentElement.getAttribute("data-tema-bawaan");
  if (bawaan === "light" || bawaan === "dark") return bawaan;
  return null;
}

/** Mode yang sedang tampil di layar (hasil terang/gelap final, bukan "auto"). */
function snapshot(): Mode {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return "dark";
  if (attr === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function serverSnapshot(): Mode {
  return "light";
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Terapkan preferensi ke <html> dan simpan pilihan pengguna. */
function terapkan(pilihan: Tema) {
  const root = document.documentElement;
  try {
    window.localStorage.setItem(KEY, pilihan);
  } catch {
    /* storage penuh / private mode: abaikan */
  }

  if (pilihan === "auto") {
    root.setAttribute(
      "data-theme",
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  } else {
    root.setAttribute("data-theme", pilihan);
  }

  window.dispatchEvent(new Event(EVENT));
}

/**
 * Tombol ganti tema: langsung terang ↔ gelap (hanya ikon matahari / bulan).
 * Pilihan pengguna disimpan di perangkat ini; bila sebelumnya "ikut sistem",
 * tekanan pertama mengunci salah satu mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  // Saat mode "auto", ikuti perubahan sistem operasi secara langsung.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((bacaTersimpan() ?? "auto") !== "auto") return;
      document.documentElement.setAttribute(
        "data-theme",
        mq.matches ? "dark" : "light",
      );
      window.dispatchEvent(new Event(EVENT));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function ganti() {
    terapkan(mode === "dark" ? "light" : "dark");
  }

  const lawan: Mode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={ganti}
      className={
        className ?? "btn btn-ghost btn-sm !min-h-8 !w-8 !rounded-full !px-0"
      }
      title={`${LABEL[mode]} — klik untuk ${LABEL[lawan].toLowerCase()}`}
      aria-label={`Tema saat ini: ${LABEL[mode]}. Klik untuk mengganti ke ${LABEL[lawan].toLowerCase()}.`}
    >
      <Icon name={mode === "light" ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}
