"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { placeMenu } from "@/lib/menu-position";

export function Menu({
  trigger,
  children,
  align = "left",
  className,
  floating = false,
}: {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Position against the window, for menus inside containers that clip their content. */
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Runs before paint, so the panel is never seen in the wrong place. A floating panel does not move
  // with the page, so scrolling or resizing closes it.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!open || !floating || !anchor || !panel) return;
    const { top, left } = placeMenu(
      anchor.getBoundingClientRect(),
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: document.documentElement.clientWidth, height: window.innerHeight },
      align
    );
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    const dismiss = (e: Event) => {
      if (!(e.target instanceof Node && panel.contains(e.target))) setOpen(false);
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, floating, align]);

  return (
    <div ref={anchorRef} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="menu"
            className={clsx(
              "z-50 min-w-[180px] rounded-[11px] border border-line bg-surface p-1.5 shadow-modal",
              floating
                ? "fixed left-0 top-0 max-h-[calc(100dvh-16px)] overflow-y-auto"
                : ["absolute mt-1.5", align === "right" ? "right-0" : "left-0"],
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
