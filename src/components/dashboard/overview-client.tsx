"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Repeat, Target, Clock, StickyNote, Wallet, Receipt } from "lucide-react";
import { TodayWidget } from "./today-widget";
import { HabitsWidget } from "./habits-widget";
import { GoalsWidget } from "./goals-widget";
import { TimesheetWidget } from "./timesheet-widget";
import { NotesWidget } from "./notes-widget";
import { EmergencyFundWidget } from "./emergency-fund-widget";
import { FinanceWidget } from "./finance-widget";
import { WeekSummaryWidget } from "./week-summary-widget";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { HabitFormModal, type GoalOption } from "@/components/habits/habit-form-modal";
import { GoalFormModal } from "@/components/goals/goal-form-modal";
import { TimeEntryFormModal, type TaskOption } from "@/components/time/time-entry-form-modal";
import { NoteFormModal } from "@/components/notes/note-form-modal";
import { IncomeFormModal } from "@/components/finance/income-form-modal";
import { ExpenseFormModal } from "@/components/finance/expense-form-modal";
import type { DashboardData } from "@/lib/dashboard";

const QUICK_ACTIONS = [
  { key: "task", label: "Task", icon: ListPlus },
  { key: "habit", label: "Habit", icon: Repeat },
  { key: "goal", label: "Goal", icon: Target },
  { key: "time", label: "Log Time", icon: Clock },
  { key: "note", label: "Note", icon: StickyNote },
  { key: "income", label: "Income", icon: Wallet },
  { key: "expense", label: "Expense", icon: Receipt },
] as const;

export function OverviewClient({
  data,
  goalOptions,
  taskOptions,
}: {
  data: DashboardData;
  goalOptions: GoalOption[];
  taskOptions: TaskOption[];
}) {
  const router = useRouter();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  function openNewTask() {
    setTaskModalOpen(true);
  }

  function handleQuickAction(key: (typeof QUICK_ACTIONS)[number]["key"]) {
    if (key === "task") openNewTask();
    else if (key === "habit") setHabitModalOpen(true);
    else if (key === "goal") setGoalModalOpen(true);
    else if (key === "time") setTimeModalOpen(true);
    else if (key === "note") setNoteModalOpen(true);
    else if (key === "income") setIncomeModalOpen(true);
    else if (key === "expense") setExpenseModalOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 lg:min-h-0">
      <div className="shrink-0 flex flex-wrap gap-[6px]">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => handleQuickAction(action.key)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line3 bg-surface px-3 py-[5px] text-[12px] text-t2 transition-colors hover:border-bar-mid hover:bg-a09 hover:text-foreground"
            >
              <Icon size={12} strokeWidth={1.75} />+ {action.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-3 lg:min-h-0">
        {/* Two 3-per-row desktop rows: Week Summary/Tasks/Notes, then
            (Habits+Goals stacked)/Timesheet/Finance. Below lg it's DOM order,
            2-per-row. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:flex-1 lg:min-h-0">
          <div className="h-[300px] md:col-span-2 lg:col-span-1 lg:h-auto lg:min-h-0">
            <WeekSummaryWidget data={data} />
          </div>

          <div className="h-[300px] lg:h-auto lg:min-h-0">
            <TodayWidget data={data} onAddTask={openNewTask} />
          </div>

          <div className="h-[300px] lg:h-auto lg:min-h-0">
            <NotesWidget data={data} onAddNote={() => setNoteModalOpen(true)} />
          </div>

          {/* Unwrapped (display:contents) below lg so Habits/Goals flow as
              flat 2-per-row grid items on tablet; at lg they re-form into a
              real stacked column. */}
          <div className="contents lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
            <div className="h-[300px] lg:h-auto lg:flex-1 lg:min-h-0">
              <HabitsWidget data={data} onAddHabit={() => setHabitModalOpen(true)} />
            </div>
            <div className="h-[300px] lg:h-auto lg:flex-1 lg:min-h-0">
              <GoalsWidget data={data} onAddGoal={() => setGoalModalOpen(true)} />
            </div>
          </div>

          {/* Timesheet and the Emergency Fund split this slot 50/50. */}
          <div className="contents lg:flex lg:flex-col lg:gap-3 lg:min-h-0">
            <div className="h-[300px] lg:h-auto lg:flex-1 lg:min-h-0">
              <TimesheetWidget data={data} onLogTime={() => setTimeModalOpen(true)} />
            </div>
            <div className="h-[300px] lg:h-auto lg:flex-1 lg:min-h-0">
              <EmergencyFundWidget data={data} />
            </div>
          </div>

          <div className="h-[300px] lg:h-auto lg:min-h-0">
            <FinanceWidget data={data} onAddIncome={() => setIncomeModalOpen(true)} onAddExpense={() => setExpenseModalOpen(true)} />
          </div>
        </div>
      </div>

      <TaskFormModal key="new-task" open={taskModalOpen} onClose={() => setTaskModalOpen(false)} task={null} />
      <HabitFormModal
        key="new-habit"
        open={habitModalOpen}
        onClose={() => {
          setHabitModalOpen(false);
          refresh();
        }}
        goals={goalOptions}
      />
      <GoalFormModal
        key="new-goal"
        open={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          refresh();
        }}
      />
      <TimeEntryFormModal
        key="new-time"
        open={timeModalOpen}
        onClose={() => {
          setTimeModalOpen(false);
          refresh();
        }}
        tasks={taskOptions}
      />
      <NoteFormModal
        key="new-note"
        open={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          refresh();
        }}
      />
      <IncomeFormModal
        key="new-income"
        open={incomeModalOpen}
        onClose={() => {
          setIncomeModalOpen(false);
          refresh();
        }}
      />
      <ExpenseFormModal
        key="new-expense"
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
