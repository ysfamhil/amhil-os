"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/date-ranges";

export function DateRangePicker({ current }: { current: DateRangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={current}
        onChange={(e) => updateParams({ range: e.target.value })}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {DATE_RANGE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {DATE_RANGE_LABELS[preset]}
          </option>
        ))}
      </select>

      {current === "custom" && (
        <>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              updateParams({ start: e.target.value || null, end: end || null });
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              updateParams({ start: start || null, end: e.target.value || null });
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </>
      )}
    </div>
  );
}
