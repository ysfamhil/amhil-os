"use client";

import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";

const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "funds", label: "Funds" },
];

export function FinanceTabBar({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => router.push(`${pathname}?tab=${tab.key}`)}
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
