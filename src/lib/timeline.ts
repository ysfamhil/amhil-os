import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TimelineEvent } from "@/types/database";

export type TimelineEventType =
  | "task_created"
  | "task_completed"
  | "project_created"
  | "project_completed"
  | "project_status_changed"
  | "learning_session_logged"
  | "learning_topic_completed"
  | "habit_completed"
  | "habit_milestone"
  | "time_entry_created"
  | "goal_created"
  | "goal_completed"
  | "client_created"
  | "lead_created"
  | "lead_won"
  | "lead_lost"
  | "income_received"
  | "expense_added"
  | "note_created";

export type TimelineCategory =
  | "Tasks"
  | "Projects"
  | "Learning"
  | "Habits"
  | "Time"
  | "Goals"
  | "Clients"
  | "Leads"
  | "Finance"
  | "Notes";

export const TIMELINE_CATEGORY_BY_EVENT_TYPE: Record<TimelineEventType, TimelineCategory> = {
  task_created: "Tasks",
  task_completed: "Tasks",
  project_created: "Projects",
  project_completed: "Projects",
  project_status_changed: "Projects",
  learning_session_logged: "Learning",
  learning_topic_completed: "Learning",
  habit_completed: "Habits",
  habit_milestone: "Habits",
  time_entry_created: "Time",
  goal_created: "Goals",
  goal_completed: "Goals",
  client_created: "Clients",
  lead_created: "Leads",
  lead_won: "Leads",
  lead_lost: "Leads",
  income_received: "Finance",
  expense_added: "Finance",
  note_created: "Notes",
};

export const TIMELINE_CATEGORIES: TimelineCategory[] = [
  "Tasks",
  "Projects",
  "Learning",
  "Habits",
  "Time",
  "Goals",
  "Clients",
  "Leads",
  "Finance",
  "Notes",
];

export interface LogTimelineEventInput {
  eventType: TimelineEventType;
  title: string;
  description?: string | null;
  occurredAt?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * The timeline is a derived, secondary record (source tables stay the real
 * system of truth — see AGENTS.md's data rule), so a logging failure here
 * must never break the primary mutation that triggered it.
 */
export async function logTimelineEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: LogTimelineEventInput
) {
  try {
    const { error } = await supabase.from("timeline_events").insert({
      user_id: userId,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      project_id: input.projectId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[timeline] logging failed:", error.message);
  } catch (err) {
    console.error("[timeline] logging threw:", err);
  }
}

/**
 * Not every entity type has its own detail page (tasks/habits/leads/income/
 * expenses/time entries only ever had list-level UI) — link to the closest
 * real page rather than inventing routes that don't exist.
 */
export function resolveTimelineEventHref(event: Pick<TimelineEvent, "related_entity_type" | "related_entity_id" | "metadata">): string | null {
  const { related_entity_type: type, related_entity_id: id, metadata } = event;
  if (!type) return null;

  switch (type) {
    case "project":
      return id ? `/projects/${id}` : "/projects";
    case "goal":
      return id ? `/goals/${id}` : "/goals";
    case "client":
      return id ? `/clients/${id}` : "/clients";
    case "learning_topic": {
      const areaId = typeof metadata?.area_id === "string" ? metadata.area_id : null;
      return areaId && id ? `/learning/${areaId}/topics/${id}` : "/learning";
    }
    case "task":
      return "/tasks";
    case "habit":
      return "/habits";
    case "lead":
      return "/leads";
    case "income":
      return "/finance?tab=income";
    case "expense":
      return "/finance?tab=expenses";
    case "time_entry":
      return "/time";
    case "note":
      return "/notes";
    default:
      return null;
  }
}
