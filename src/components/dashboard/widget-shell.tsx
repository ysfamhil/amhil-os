import clsx from "clsx";
import type { ReactNode } from "react";
import { DOMAIN_COLORS, type Domain } from "@/components/ui/card";

export function WidgetShell({
  title,
  meta,
  action,
  domain,
  color: colorProp,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  domain?: Domain;
  /** Raw CSS color for the top-rule/dot when this widget isn't a single domain. */
  color?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const color = colorProp ?? (domain ? DOMAIN_COLORS[domain] : undefined);
  return (
    <div
      className={clsx(
        "flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-card",
        className
      )}
      style={color ? { boxShadow: `inset 0 3px 0 0 ${color}` } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-[16px] py-[13px]">
        <div className="flex min-w-0 items-center gap-2">
          {color && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: color }} />}
          <h2 className="truncate text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
          {meta && <span className="hidden shrink-0 font-mono text-[10.5px] text-t7 sm:inline">{meta}</span>}
        </div>
        {action}
      </div>
      <div className={clsx("scroll-thin flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
    </div>
  );
}

export function WidgetAddButton({ onClick, label, domain }: { onClick: () => void; label: string; domain?: Domain }) {
  const color = domain ? DOMAIN_COLORS[domain] : "var(--accent)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors hover:bg-surface2"
      style={{ color }}
    >
      + {label}
    </button>
  );
}
