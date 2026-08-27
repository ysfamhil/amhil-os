"use client";

import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";

const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "productivity", label: "Productivity" },
  { key: "learning", label: "Learning" },
  { key: "projects", label: "Projects" },
  { key: "finance", label: "Finance" },
  { key: "habits", label: "Habits" },
  { key: "goals", label: "Goals" },
  { key: "weekly-review", label: "Weekly Review" },
  { key: "monthly-review", label: "Monthly Review" },
];

export function ReportsTabBar({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function goToTab(tab: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => goToTab(tab.key)}
          className={clsx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
