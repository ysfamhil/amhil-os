"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";

export function Menu({
  trigger,
  children,
  align = "left",
  className,
}: {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className={clsx(
              "absolute z-50 mt-1.5 min-w-[180px] rounded-[11px] border border-line bg-surface p-1.5 shadow-modal",
              align === "right" ? "right-0" : "left-0",
              className
            )}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
  icon,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-left text-[13px] font-medium transition-colors",
        danger ? "text-red hover:bg-r13" : "text-t2 hover:bg-surface2 hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuCheckboxItem({
  checked,
  onToggle,
  children,
  color,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-left text-[13px] font-medium text-t2 transition-colors hover:bg-surface2 hover:text-foreground"
    >
      <span
        className={clsx(
          "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border",
          checked ? "border-transparent" : "border-line4"
        )}
        style={checked ? { backgroundColor: color ?? "var(--accent)" } : undefined}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-on-accent" />}
      </span>
      {color && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1.5 h-px bg-line" />;
}
