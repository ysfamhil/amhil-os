"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Repeat, Plus } from "lucide-react";
import { HabitRow } from "@/components/habits/habit-row";
import { HabitFormModal, type GoalOption } from "@/components/habits/habit-form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteHabit, setHabitActive, setHabitCompletion } from "@/lib/actions/habits";
import { todayISODate } from "@/lib/dates";
import type { HabitWithStats } from "@/lib/queries/habits";
import type { Habit } from "@/types/database";

export function HabitsBoard({ habits, goals = [] }: { habits: HabitWithStats[]; goals?: GoalOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<HabitWithStats | null>(null);

  const active = habits.filter((h) => h.is_active);
  const archived = habits.filter((h) => !h.is_active);

  function openNew() {
    setEditingHabit(null);
    setModalOpen(true);
  }

  async function handleToggle(habit: HabitWithStats, completed: boolean) {
    await setHabitCompletion(habit.id, todayISODate(), completed);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Habit
        </button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Track a lightweight daily or weekly habit and watch your streak build."
          action={
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Habit
            </button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {active.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                onToggle={(completed) => handleToggle(habit, completed)}
                onEdit={() => {
                  setEditingHabit(habit);
                  setModalOpen(true);
                }}
                onToggleActive={async () => {
                  await setHabitActive(habit.id, false);
                  router.refresh();
                }}
                onDelete={() => setDeletingHabit(habit)}
              />
            ))}
          </div>

          {archived.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-muted">Archived</h2>
              <div className="flex flex-col gap-3">
                {archived.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    onToggle={(completed) => handleToggle(habit, completed)}
                    onEdit={() => {
                      setEditingHabit(habit);
                      setModalOpen(true);
                    }}
                    onToggleActive={async () => {
                      await setHabitActive(habit.id, true);
                      router.refresh();
                    }}
                    onDelete={() => setDeletingHabit(habit)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <HabitFormModal
        key={editingHabit?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        habit={editingHabit}
        goals={goals}
      />

      <ConfirmDialog
        open={Boolean(deletingHabit)}
        onClose={() => setDeletingHabit(null)}
        title="Delete habit"
        description={`Delete "${deletingHabit?.name}"? This also removes its full completion history. This can't be undone.`}
        onConfirm={async () => {
          if (deletingHabit) {
            await deleteHabit(deletingHabit.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
