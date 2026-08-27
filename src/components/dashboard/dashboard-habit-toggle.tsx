"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { setHabitCompletion } from "@/lib/actions/habits";
import { todayISODate } from "@/lib/dates";

export function DashboardHabitToggle({
  habitId,
  name,
  completedToday,
}: {
  habitId: string;
  name: string;
  completedToday: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await setHabitCompletion(habitId, todayISODate(), !completedToday);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="flex w-full items-center justify-between text-sm disabled:opacity-50"
    >
      <span>{name}</span>
      <Badge tone={completedToday ? "success" : "neutral"}>{completedToday ? "Done" : "Mark done"}</Badge>
    </button>
  );
}
