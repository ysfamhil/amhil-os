"use client";

import { useState } from "react";
import Link from "next/link";
import { QUICK_ACTIONS } from "@/lib/quick-actions";

export function NewMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-accent px-[13px] py-[7px] text-[12px] font-semibold text-on-accent transition-colors hover:bg-accent-hi"
      >
        + New
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-modal">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-t2 hover:bg-surface2 hover:text-foreground"
                >
                  <Icon size={16} strokeWidth={1.5} className="text-t6" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
