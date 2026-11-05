"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * Tombol "+"" yang membuka formulir dalam modal (bottom-sheet di HP,
 * dialog terpusat di laptop). Lebih jelas daripada tombol yang hanya
 * melempar pengguna ke bawah halaman.
 */
export function ActionModal({
  label = "Tambah",
  title,
  hint,
  icon = "plus",
  className = "btn btn-primary btn-sm",
  children,
}: {
  label?: string;
  title: string;
  hint?: string;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Fokuskan elemen pertama agar keyboard/AT langsung masuk ke formulir.
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), select, textarea, button",
      );
      focusable?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Icon name={icon} className="h-4 w-4" />
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            aria-label="Tutup"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:pb-4"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden"
            />
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight">{title}</h2>
                {hint ? (
                  <p className="muted mt-0.5 text-xs">{hint}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm !w-10 !rounded-full !px-0 sm:!w-8"
                onClick={() => setOpen(false)}
                aria-label="Tutup formulir"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
