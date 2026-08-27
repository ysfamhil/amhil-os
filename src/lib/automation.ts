import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationType } from "@/types/database";
import { todayISODate, addDaysISODate } from "@/lib/dates";

const STALE_PROJECT_DAYS = 14;
const GOAL_DEADLINE_HORIZON_DAYS = 3;
const PAYMENT_REMINDER_AGE_DAYS = 30;

interface Candidate {
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}

/**
 * Computes the six example automation checks against real, current data and
 * inserts a notification for anything newly detected. Deliberately runs
 * on-demand (called from the dashboard load) rather than on a schedule —
 * this environment has no persistent background worker, and standing one up
 * for a personal single-user app would be exactly the unnecessary
 * infrastructure the phase spec says to avoid.
 */
export async function runAutomationChecks(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const today = todayISODate();
  const candidates: Candidate[] = [];

  const [overdueTasksRes, activeProjectsRes, habitsRes, goalsRes, invoicedIncomeRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title")
      .eq("user_id", userId)
      .lt("due_date", today)
      .not("status", "in", "(Done,Cancelled)"),
    supabase.from("projects").select("id,name,updated_at").eq("user_id", userId).eq("status", "Active"),
    supabase.from("habits").select("id,name").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("goals")
      .select("id,title,target_date")
      .eq("user_id", userId)
      .in("status", ["Not Started", "In Progress"])
      .not("target_date", "is", null)
      .gte("target_date", today)
      .lte("target_date", addDaysISODate(GOAL_DEADLINE_HORIZON_DAYS)),
    supabase
      .from("income")
      .select("id,amount,currency,date,clients(name)")
      .eq("user_id", userId)
      .eq("status", "Invoiced")
      .lte("date", addDaysISODate(-PAYMENT_REMINDER_AGE_DAYS)),
  ]);

  for (const task of overdueTasksRes.data ?? []) {
    candidates.push({
      type: "task_overdue",
      title: "Overdue task",
      message: `"${task.title}" is overdue.`,
      relatedEntityType: "task",
      relatedEntityId: task.id,
    });
  }

  const staleThreshold = `${addDaysISODate(-STALE_PROJECT_DAYS)}T00:00:00.000Z`;
  for (const project of activeProjectsRes.data ?? []) {
    if (project.updated_at < staleThreshold) {
      candidates.push({
        type: "stale_project",
        title: "Stale project",
        message: `"${project.name}" has had no activity for ${STALE_PROJECT_DAYS}+ days.`,
        relatedEntityType: "project",
        relatedEntityId: project.id,
      });
    }
  }

  const habitIds = (habitsRes.data ?? []).map((h) => h.id);
  const { data: completedToday } = habitIds.length
    ? await supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("date", today).in("habit_id", habitIds)
    : { data: [] };
  const completedTodayIds = new Set((completedToday ?? []).map((c) => c.habit_id));
  for (const habit of habitsRes.data ?? []) {
    if (!completedTodayIds.has(habit.id)) {
      candidates.push({
        type: "habit_reminder",
        title: "Habit reminder",
        message: `You haven't completed "${habit.name}" today.`,
        relatedEntityType: "habit",
        relatedEntityId: habit.id,
      });
    }
  }

  for (const goal of goalsRes.data ?? []) {
    candidates.push({
      type: "goal_deadline",
      title: "Goal deadline approaching",
      message: `"${goal.title}" is due ${goal.target_date}.`,
      relatedEntityType: "goal",
      relatedEntityId: goal.id,
    });
  }

  for (const income of (invoicedIncomeRes.data ?? []) as unknown as {
    id: string;
    amount: number;
    currency: string;
    date: string;
    clients: { name: string } | null;
  }[]) {
    candidates.push({
      type: "payment_reminder",
      title: "Payment reminder",
      message: `${income.amount.toLocaleString()} ${income.currency} invoiced${income.clients ? ` to ${income.clients.name}` : ""} on ${income.date} is still unpaid.`,
      relatedEntityType: "income",
      relatedEntityId: income.id,
    });
  }

  if (candidates.length === 0) return 0;

  // A single atomic upsert, not a check-then-insert loop: the
  // notifications_dedupe_idx unique index on (user_id, type,
  // related_entity_id, occurred_on) makes Postgres itself the source of
  // truth for "has this already been notified today" — concurrent calls
  // can never both create the same notification, because the database
  // rejects (and here, silently skips via ignoreDuplicates) the conflicting
  // row rather than the application deciding after a separate read.
  const { data, error } = await supabase
    .from("notifications")
    .upsert(
      candidates.map((candidate) => ({
        user_id: userId,
        type: candidate.type,
        title: candidate.title,
        message: candidate.message,
        related_entity_type: candidate.relatedEntityType,
        related_entity_id: candidate.relatedEntityId,
        occurred_on: today,
      })),
      { onConflict: "user_id,type,related_entity_id,occurred_on", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[automation] upsert failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}
