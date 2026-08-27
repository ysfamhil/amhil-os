"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Target, Plus } from "lucide-react";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalFormModal } from "@/components/goals/goal-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { GoalWithProgress } from "@/lib/queries/goals";

export function GoalsBoard({ goals }: { goals: GoalWithProgress[] }) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a goal and connect it to the tasks or projects that move it forward."
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Goal
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      <GoalFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
