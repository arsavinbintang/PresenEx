import { Icon } from "@/components/ui/icons";

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: React.ReactNode;
}) {
  const map = {
    info: { bg: "var(--accent-soft)", fg: "var(--accent)", icon: "alert" as const },
    warning: { bg: "var(--sakit-soft)", fg: "var(--sakit)", icon: "alert" as const },
    danger: { bg: "var(--alpha-soft)", fg: "var(--alpha)", icon: "alert" as const },
    success: { bg: "var(--hadir-soft)", fg: "var(--hadir)", icon: "check" as const },
  };
  const style = map[tone];

  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: style.bg, color: style.fg }}
      role="status"
    >
      <Icon name={style.icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
