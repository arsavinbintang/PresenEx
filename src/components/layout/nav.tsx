"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils/format";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title ? (
            <p className="muted mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-wider">
              {group.title}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                  style={active ? { background: "var(--accent-soft)" } : undefined}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface)] md:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold",
                active ? "text-[var(--accent)]" : "text-[var(--muted)]",
              )}
            >
              <Icon name={item.icon} className="h-[21px] w-[21px]" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
