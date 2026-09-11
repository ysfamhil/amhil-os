"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, Search, X } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { ProfileMenu } from "./profile-menu";
import type { Notification } from "@/types/database";

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const color = item.domainVar ? `var(${item.domainVar})` : "var(--accent)";
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={clsx(
        "whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[13px] font-semibold transition-colors",
        isActive ? "text-foreground" : "text-t3 hover:bg-surface2 hover:text-foreground"
      )}
      style={isActive ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined}
    >
      {item.label}
    </Link>
  );
}

export function AppHeader({
  fullName,
  email,
  avatarUrl,
  notifications,
  unreadCount,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  notifications: Notification[];
  unreadCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-topbar">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground md:hidden"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <Link href="/dashboard" className="flex shrink-0 items-center gap-[9px] pr-2">
          <div className="flex h-[24px] w-[24px] items-center justify-center rounded-[7px] bg-accent font-mono text-[12px] font-bold text-accent-foreground">
            A
          </div>
          <span className="hidden text-[14px] font-extrabold tracking-[-0.01em] lg:inline">AMHIL OS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          aria-label="Search everything"
          className="mr-2 hidden items-center gap-2 rounded-lg border border-line3 px-3 py-[6px] text-[12px] text-t6 transition-colors hover:border-line5 hover:text-t3 lg:flex"
        >
          <Search size={13} strokeWidth={1.5} />
          Search everything
          <kbd className="rounded border border-line4 px-[5px] py-[1px] font-mono text-[10px] text-t6">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          aria-label="Search"
          className="mr-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-t6 hover:bg-surface2 hover:text-foreground lg:hidden"
        >
          <Search size={16} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-1.5">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <ThemeToggle />
          <ProfileMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>

      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>
      )}
    </header>
  );
}
