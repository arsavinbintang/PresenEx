import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

export function Empty({
  icon = "archive",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)]"
        style={{ background: "var(--surface-2)" }}
      >
        <Icon name={icon} />
      </div>
      <p className="font-semibold">{title}</p>
      {description ? (
        <p className="muted mt-1 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
