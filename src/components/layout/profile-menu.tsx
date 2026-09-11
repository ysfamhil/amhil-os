"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || "?";
}

export function ProfileMenu({ fullName, email, avatarUrl }: { fullName: string | null; email: string | null; avatarUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied external URL, not a local/optimizable asset
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(fullName, email)
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-modal">
          <div className="border-b border-line2 px-2.5 py-2">
            <p className="truncate text-sm font-medium">{fullName || "Account"}</p>
            {email && <p className="truncate text-xs text-muted">{email}</p>}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-surface2"
          >
            <User size={15} strokeWidth={1.5} className="text-t6" />
            My Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-surface2"
          >
            <Settings size={15} strokeWidth={1.5} className="text-t6" />
            Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-r10"
          >
            <LogOut size={15} strokeWidth={1.5} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
