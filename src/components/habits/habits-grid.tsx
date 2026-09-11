"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Flame, Pencil, Archive, ArchiveRestore, Trash2, Plus, Repeat } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HabitFormModal, type GoalOption } from "@/components/habits/habit-form-modal";
import { deleteHabit, setHabitActive, setHabitCompletion } from "@/lib/actions/habits";
import { addDaysISODate, todayISODate } from "@/lib/dates";
import type { HabitWithStats } from "@/lib/queries/habits";
import type { Habit } from "@/types/database";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function rangeLabel(weekDates: string[]) {
  const start = new Date(`${weekDates[0]}T00:00:00`);
  const end = new Date(`${weekDates[6]}T00:00:00`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}, ${end.getFullYear()}`
      : end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function DayCell({ habit, date, isToday }: { habit: HabitWithStats; date: string; isToday: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const completed = habit.weekCompletions[date] ?? false;

  async function toggle() {
    setPending(true);
    try {
      await setHabitCompletion(habit.id, date, !completed);
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
      aria-label={completed ? "Mark not done" : "Mark done"}
      className={clsx(
        "mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50",
        completed
          ? "border-success bg-success/15 text-success"
          : "border-border text-transparent hover:border-accent hover:text-accent/40",
        isToday && !completed && "border-accent/60"
      )}
    >
      <Check size={15} />
    </button>
  );
}

function HabitTable({
  habits,
  weekDates,
  today,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  habits: HabitWithStats[];
  weekDates: string[];
  today: string;
  onEdit: (habit: Habit) => void;
  onToggleActive: (habit: HabitWithStats) => void;
  onDelete: (habit: HabitWithStats) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface2 text-[10.5px] uppercase tracking-[0.07em] text-t5">
            <th className="px-4 py-[9px] text-left font-medium">Habit</th>
            {weekDates.map((date, i) => (
              <th key={date} className={clsx("px-1 py-[9px] text-center font-medium", date === today && "text-accent")}>
                {DAY_LABELS[i]}
                <div className="font-mono text-[10px] normal-case text-t7">{Number(date.slice(8, 10))}</div>
              </th>
            ))}
            <th className="px-3 py-[9px] text-right font-medium">Streak</th>
            <th className="px-3 py-[9px] text-right font-medium">Best</th>
            <th className="px-3 py-[9px] text-right font-medium">Week</th>
            <th className="px-2 py-[9px]" />
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => (
            <tr key={habit.id} className={clsx("border-b border-line2 last:border-b-0", !habit.is_active && "opacity-50")}>
              <td className="px-4 py-2.5 font-medium">{habit.name}</td>
              {weekDates.map((date) => (
                <td key={date} className={clsx("px-1 py-1.5", date === today && "bg-a05")}>
                  <DayCell habit={habit} date={date} isToday={date === today} />
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-t2">
                <span className="inline-flex items-center gap-1">
                  <Flame size={12} className={habit.currentStreak > 0 ? "text-amber" : "text-t6"} />
                  {habit.currentStreak}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-t4">{habit.bestStreak}</td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-t4">{habit.weeklyConsistency}%</td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => onEdit(habit)} aria-label="Edit habit" className="rounded-lg p-1.5 text-muted hover:bg-border/40 hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleActive(habit)}
                    aria-label={habit.is_active ? "Archive habit" : "Reactivate habit"}
                    className="rounded-lg p-1.5 text-muted hover:bg-border/40 hover:text-foreground"
                  >
                    {habit.is_active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                  </button>
                  <button type="button" onClick={() => onDelete(habit)} aria-label="Delete habit" className="rounded-lg p-1.5 text-muted hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HabitsGrid({
  habits,
  goals = [],
  weekDates,
  weekStart,
}: {
  habits: HabitWithStats[];
  goals?: GoalOption[];
  weekDates: string[];
  weekStart: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<HabitWithStats | null>(null);

  const today = todayISODate();
  const active = habits.filter((h) => h.is_active);
  const archived = habits.filter((h) => !h.is_active);

  function goToWeek(mondayISO: string) {
    startTransition(() => {
      router.push(`${pathname}?week=${mondayISO}`);
    });
  }

  function openNew() {
    setEditingHabit(null);
    setModalOpen(true);
  }

  async function handleToggleActive(habit: HabitWithStats) {
    await setHabitActive(habit.id, !habit.is_active);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToWeek(addDaysISODate(-7, new Date(`${weekStart}T00:00:00`)))}
            aria-label="Previous week"
            className="rounded-lg border border-border p-1.5 hover:bg-border/40"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[160px] text-center text-sm font-medium">{rangeLabel(weekDates)}</span>
          <button
            type="button"
            onClick={() => goToWeek(addDaysISODate(7, new Date(`${weekStart}T00:00:00`)))}
            aria-label="Next week"
            className="rounded-lg border border-border p-1.5 hover:bg-border/40"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="ml-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-border/40"
          >
            Today
          </button>
        </div>

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
          description="Track a lightweight daily habit and watch your streak build."
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
          {active.length > 0 && (
            <HabitTable
              habits={active}
              weekDates={weekDates}
              today={today}
              onEdit={(h) => {
                setEditingHabit(h);
                setModalOpen(true);
              }}
              onToggleActive={handleToggleActive}
              onDelete={setDeletingHabit}
            />
          )}

          {archived.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Archived</h2>
              <HabitTable
                habits={archived}
                weekDates={weekDates}
                today={today}
                onEdit={(h) => {
                  setEditingHabit(h);
                  setModalOpen(true);
                }}
                onToggleActive={handleToggleActive}
                onDelete={setDeletingHabit}
              />
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
