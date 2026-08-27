"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.body isn't available until after mount; needed to know when the portal target exists
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground"
      >
        <Menu size={18} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="relative flex w-72 flex-col bg-surface px-4 py-6 shadow-xl">
              <div className="mb-8 flex items-center justify-between px-2">
                <div>
                  <p className="text-lg font-semibold tracking-tight">AMHIL OS</p>
                  <p className="text-xs text-muted">Personal command center</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-border/40"
                >
                  <X size={18} />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="mt-auto border-t border-border pt-4">
                <SignOutButton />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
