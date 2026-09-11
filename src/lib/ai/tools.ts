import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TaskStatus } from "@/types/database";
import type { AIToolDefinition } from "./provider";
import { getProjects } from "@/lib/queries/projects";
import { getHabits } from "@/lib/queries/habits";
import { getGoals } from "@/lib/queries/goals";
import { getTimeEntries } from "@/lib/queries/time-entries";
import { getTimelineEvents } from "@/lib/queries/timeline";
import { searchAll } from "@/lib/actions/search";

const dateRangeSchema = {
  start: { type: "string", description: "ISO date (YYYY-MM-DD), inclusive. Omit for no lower bound." },
  end: { type: "string", description: "ISO date (YYYY-MM-DD), inclusive. Omit for no upper bound." },
};

/**
 * Every tool below is a fixed, parameterized read (or, for propose_create_task,
 * a no-op that only returns a suggestion) — never a raw SQL escape hatch.
 * Each one runs through the same RLS-scoped Supabase client every page
 * already uses, scoped to the authenticated user, so the model can never
 * see another user's rows regardless of what it asks for.
 */
export const AI_TOOLS: AIToolDefinition[] = [
  {
    name: "get_tasks",
    description: "List the user's tasks, optionally filtered by status and/or a due-date range.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Backlog", "Todo", "In Progress", "Waiting", "Done", "Cancelled"] },
        due_start: dateRangeSchema.start,
        due_end: dateRangeSchema.end,
      },
    },
  },
  {
    name: "get_projects",
    description: "List the user's projects with stats: progress, hours invested, revenue, expenses, profit.",
    inputSchema: { type: "object", properties: { status: { type: "string" } } },
  },
  {
    name: "get_learning_sessions",
    description: "List learning sessions logged in a date range, with topic and area names and duration.",
    inputSchema: { type: "object", properties: dateRangeSchema },
  },
  {
    name: "get_time_entries",
    description: "List time entries in a date range, with project/task names, category, and duration.",
    inputSchema: { type: "object", properties: dateRangeSchema },
  },
  {
    name: "get_income",
    description: "List income records in a date range. Status is one of Expected/Invoiced/Paid/Cancelled — only Paid counts as actual revenue.",
    inputSchema: { type: "object", properties: dateRangeSchema },
  },
  {
    name: "get_expenses",
    description: "List expense records in a date range, with category and project.",
    inputSchema: { type: "object", properties: dateRangeSchema },
  },
  {
    name: "get_habits",
    description: "List the user's habits with current/best streak and weekly/monthly consistency percentages.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_goals",
    description: "List the user's goals with progress, status, and target dates.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_timeline_events",
    description: "List recent activity timeline events in a date range (task completions, income received, etc.).",
    inputSchema: { type: "object", properties: dateRangeSchema },
  },
  {
    name: "search_everything",
    description: "Full-text search across tasks, projects, goals, learning, habits, clients, leads, notes, and timeline for a keyword or topic.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "propose_create_task",
    description:
      "Propose creating a new task. This does NOT create it — it only returns a suggestion for the user to confirm in the UI. Never call this without the user having asked for a task to be created.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "ISO date (YYYY-MM-DD), optional." },
        priority: { type: "string", enum: ["Low", "Medium", "High", "Urgent"] },
      },
      required: ["title"],
    },
  },
];

function limitRows<T>(rows: T[], max = 200): T[] {
  return rows.slice(0, max);
}

export interface ProposedAction {
  type: "create_task";
  payload: { title: string; due_date: string | null; priority: string | null };
}

export async function runAITool(
  supabase: SupabaseClient<Database>,
  userId: string,
  name: string,
  input: Record<string, unknown>
): Promise<{ content: string; proposedAction?: ProposedAction }> {
  switch (name) {
    case "get_tasks": {
      let query = supabase
        .from("tasks")
        .select("id,title,status,priority,due_date,completed_at,project_id,created_at")
        .eq("user_id", userId);
      if (typeof input.status === "string") query = query.eq("status", input.status as TaskStatus);
      if (typeof input.due_start === "string") query = query.gte("due_date", input.due_start);
      if (typeof input.due_end === "string") query = query.lte("due_date", input.due_end);
      const { data, error } = await query.order("due_date", { ascending: true }).limit(200);
      if (error) throw new Error(error.message);
      return { content: JSON.stringify(limitRows(data ?? [])) };
    }

    case "get_projects": {
      const status = typeof input.status === "string" ? (input.status as never) : undefined;
      const projects = await getProjects(supabase, userId, status);
      return {
        content: JSON.stringify(
          limitRows(
            projects.map((p) => ({
              name: p.name,
              status: p.status,
              progress: p.progress,
              hoursInvested: p.hoursInvested,
              revenue: p.revenue,
              expenses: p.expenses,
              profit: p.profit,
            }))
          )
        ),
      };
    }

    case "get_learning_sessions": {
      let query = supabase
        .from("learning_sessions")
        .select("date,duration_minutes,notes,what_learned,learning_topics(name,learning_areas(name))")
        .eq("user_id", userId);
      if (typeof input.start === "string") query = query.gte("date", input.start);
      if (typeof input.end === "string") query = query.lte("date", input.end);
      const { data, error } = await query.order("date", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return { content: JSON.stringify(limitRows(data ?? [])) };
    }

    case "get_time_entries": {
      const entries = await getTimeEntries(supabase, userId, {});
      const filtered = entries.filter((e) => {
        if (typeof input.start === "string" && e.date < input.start) return false;
        if (typeof input.end === "string" && e.date > input.end) return false;
        return true;
      });
      return {
        content: JSON.stringify(
          limitRows(
            filtered.map((e) => ({
              date: e.date,
              duration_minutes: e.duration_minutes,
              category: e.category,
              task: e.tasks?.title ?? null,
              description: e.description,
            }))
          )
        ),
      };
    }

    case "get_income": {
      let query = supabase
        .from("income")
        .select("amount,currency,date,status,source,clients(name),projects(name)")
        .eq("user_id", userId);
      if (typeof input.start === "string") query = query.gte("date", input.start);
      if (typeof input.end === "string") query = query.lte("date", input.end);
      const { data, error } = await query.order("date", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return { content: JSON.stringify(limitRows(data ?? [])) };
    }

    case "get_expenses": {
      let query = supabase
        .from("expenses")
        .select("amount,currency,date,category,description,projects(name)")
        .eq("user_id", userId);
      if (typeof input.start === "string") query = query.gte("date", input.start);
      if (typeof input.end === "string") query = query.lte("date", input.end);
      const { data, error } = await query.order("date", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return { content: JSON.stringify(limitRows(data ?? [])) };
    }

    case "get_habits": {
      const habits = await getHabits(supabase, userId);
      return {
        content: JSON.stringify(
          habits.map((h) => ({
            name: h.name,
            is_active: h.is_active,
            currentStreak: h.currentStreak,
            bestStreak: h.bestStreak,
            weeklyConsistency: h.weeklyConsistency,
            monthlyConsistency: h.monthlyConsistency,
            completionRate: h.completionRate,
          }))
        ),
      };
    }

    case "get_goals": {
      const goals = await getGoals(supabase, userId);
      return {
        content: JSON.stringify(
          goals.map((g) => ({
            title: g.title,
            status: g.status,
            progress: g.progress,
            category: g.category,
            target_date: g.target_date,
          }))
        ),
      };
    }

    case "get_timeline_events": {
      const { events } = await getTimelineEvents(supabase, userId, {
        start: typeof input.start === "string" ? input.start : undefined,
        end: typeof input.end === "string" ? input.end : undefined,
      });
      return {
        content: JSON.stringify(
          limitRows(events.map((e) => ({ title: e.title, event_type: e.event_type, occurred_at: e.occurred_at })))
        ),
      };
    }

    case "search_everything": {
      const query = typeof input.query === "string" ? input.query : "";
      const groups = await searchAll(query);
      return { content: JSON.stringify(groups) };
    }

    case "propose_create_task": {
      const proposedAction: ProposedAction = {
        type: "create_task",
        payload: {
          title: String(input.title ?? ""),
          due_date: typeof input.due_date === "string" ? input.due_date : null,
          priority: typeof input.priority === "string" ? input.priority : null,
        },
      };
      return { content: JSON.stringify({ ok: true }), proposedAction };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
