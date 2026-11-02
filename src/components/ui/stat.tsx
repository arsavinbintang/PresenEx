import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "hadir" | "alpha" | "accent" | "muted";
  href?: string;
}) {
  const color =
    tone === "hadir"
      ? "var(--hadir)"
      : tone === "alpha"
        ? "var(--alpha)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--foreground)";

  const inner = (
    <div className="card h-full p-4">
      <p className="muted text-[0.72rem] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight")}
        style={{ color }}
      >
        {value}
      </p>
      {hint ? <p className="muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );

  return href ? (
    <a href={href} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
