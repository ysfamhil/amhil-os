// Hand-written to match supabase/migrations/20260826000001_init_schema.sql.
// If the CLI's Keychain-based auth is ever unblocked, the authoritative version
// can be regenerated with:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type TaskStatus = "Backlog" | "Todo" | "In Progress" | "Waiting" | "Done" | "Cancelled";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";
export type ProjectStatus = "Idea" | "Planned" | "Active" | "On Hold" | "Completed" | "Archived";
export type MilestoneStatus = "Planned" | "In Progress" | "Completed";
export type GoalStatus = "Not Started" | "In Progress" | "Completed" | "Cancelled";
export type LearningTopicStatus = "Not Started" | "Learning" | "Practicing" | "Completed" | "Reviewing";
export type HabitFrequency = "daily" | "weekly" | "custom";
export type ClientStatus =
  | "Lead"
  | "Contacted"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost"
  | "Client"
  | "Inactive";
export type LeadStatus = "Lead" | "Contacted" | "Proposal" | "Negotiation" | "Won" | "Lost";
export type IncomeStatus = "Expected" | "Invoiced" | "Paid" | "Cancelled";
export type CrmLeadStatus = "New" | "Contacted" | "Replied" | "Mockup sent" | "Won" | "Lost";

interface Timestamped {
  created_at: string;
  updated_at: string;
}

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "suspended";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  source: string | null;
  status: ClientStatus;
  notes: string | null;
}

export interface Lead extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  contact: string | null;
  source: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  notes: string | null;
  contacted_at: string | null;
  converted_at: string | null;
  converted_client_id: string | null;
}

export interface Goal extends Timestamped {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string | null;
  target_date: string | null;
  status: GoalStatus;
  progress: number;
  position: number;
}

export interface Project extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  client_id: string | null;
  goal_id: string | null;
  category: string | null;
  budget: number | null;
  estimated_hours: number | null;
  notes: string | null;
}

export interface ProjectMilestone extends Timestamped {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: MilestoneStatus;
}

export interface Task extends Timestamped {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  project_id: string | null;
  goal_id: string | null;
  category: string | null;
  notes: string | null;
  position: number;
}

export interface Subtask extends Timestamped {
  id: string;
  user_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

export interface LearningArea extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
}

export interface LearningTopic extends Timestamped {
  id: string;
  user_id: string;
  area_id: string;
  goal_id: string | null;
  name: string;
  status: LearningTopicStatus;
  progress: number;
  confidence: number | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface LearningSession extends Timestamped {
  id: string;
  user_id: string;
  topic_id: string;
  date: string;
  duration_minutes: number;
  notes: string | null;
  what_learned: string | null;
  confidence_before: number | null;
  confidence_after: number | null;
}

export interface Habit extends Timestamped {
  id: string;
  user_id: string;
  goal_id: string | null;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  target: number;
  is_active: boolean;
}

export interface HabitCompletion extends Timestamped {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  is_completed: boolean;
  note: string | null;
}

export interface TimeEntry extends Timestamped {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  category: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  description: string | null;
}

export interface Income extends Timestamped {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  date: string;
  client_id: string | null;
  project_id: string | null;
  source: string | null;
  description: string | null;
  status: IncomeStatus;
  payment_date: string | null;
}

export interface Expense extends Timestamped {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  date: string;
  category: string | null;
  project_id: string | null;
  description: string | null;
}

export interface EmergencyFund extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
}

export interface EmergencyFundTransaction extends Timestamped {
  id: string;
  user_id: string;
  fund_id: string;
  amount: number;
  note: string | null;
}

export interface CrmLead extends Timestamped {
  id: string;
  user_id: string;
  name: string;
  website_url: string | null;
  contact: string | null;
  status: CrmLeadStatus;
  notes: string | null;
  date: string;
  follow_up_count: number;
  last_followed_up: string | null;
  status_changed_at: string;
}

export interface Note extends Timestamped {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  tags: string[];
  project_id: string | null;
  task_id: string | null;
  learning_topic_id: string | null;
  client_id: string | null;
  goal_id: string | null;
}

export type NotificationType =
  | "task_overdue"
  | "upcoming_deadline"
  | "goal_deadline"
  | "stale_project"
  | "habit_reminder"
  | "payment_reminder";

export interface Notification extends Timestamped {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  occurred_on: string;
}

export interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  project_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase client generics: Row/Insert/Update per table, matching the shape
// @supabase/postgrest-js expects from createClient<Database>().
// ---------------------------------------------------------------------------

// Named interfaces (especially ones using `extends`) confuse @supabase/postgrest-js's
// conditional Insert/Update extraction and silently resolve to `never` — flattening
// them into a fresh mapped type first works around it. See postgrest-js's own
// `Prettify<T>` helper, which does the same thing for the same reason.
type Flatten<T> = { [K in keyof T]: T[K] };

type InsertOf<Row, Required extends keyof Row> = Flatten<
  Pick<Row, Required> & Partial<Omit<Row, Required>>
>;
type UpdateOf<Row> = Flatten<Partial<Row>>;

type ProfileInsert = InsertOf<Profile, "id">;
type ClientInsert = InsertOf<Client, "name">;
type LeadInsert = InsertOf<Lead, "name">;
type GoalInsert = InsertOf<Goal, "title">;
type ProjectInsert = InsertOf<Project, "name">;
type ProjectMilestoneInsert = InsertOf<ProjectMilestone, "project_id" | "title">;
type TaskInsert = InsertOf<Task, "title">;
type SubtaskInsert = InsertOf<Subtask, "task_id" | "title">;
type TagInsert = InsertOf<Tag, "name">;
type TaskTagInsert = InsertOf<TaskTag, "task_id" | "tag_id">;
type LearningAreaInsert = InsertOf<LearningArea, "name">;
type LearningTopicInsert = InsertOf<LearningTopic, "area_id" | "name">;
type LearningSessionInsert = InsertOf<LearningSession, "topic_id" | "duration_minutes">;
type HabitInsert = InsertOf<Habit, "name">;
type HabitCompletionInsert = InsertOf<HabitCompletion, "habit_id" | "date">;
type TimeEntryInsert = InsertOf<TimeEntry, "duration_minutes">;
type IncomeInsert = InsertOf<Income, "amount">;
type ExpenseInsert = InsertOf<Expense, "amount">;
type EmergencyFundInsert = InsertOf<EmergencyFund, "user_id">;
type EmergencyFundTransactionInsert = InsertOf<EmergencyFundTransaction, "amount" | "fund_id">;
type NoteInsert = InsertOf<Note, "title">;
type CrmLeadInsert = InsertOf<CrmLead, "name">;
type TimelineEventInsert = InsertOf<TimelineEvent, "event_type" | "title">;
type NotificationInsert = InsertOf<Notification, "type" | "title" | "message">;

interface TableDef<Row, Insert> {
  Row: Flatten<Row>;
  Insert: Insert;
  Update: UpdateOf<Row>;
  Relationships: never[];
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, ProfileInsert>;
      clients: TableDef<Client, ClientInsert>;
      leads: TableDef<Lead, LeadInsert>;
      goals: TableDef<Goal, GoalInsert>;
      projects: TableDef<Project, ProjectInsert>;
      project_milestones: TableDef<ProjectMilestone, ProjectMilestoneInsert>;
      tasks: TableDef<Task, TaskInsert>;
      subtasks: TableDef<Subtask, SubtaskInsert>;
      tags: TableDef<Tag, TagInsert>;
      task_tags: TableDef<TaskTag, TaskTagInsert>;
      learning_areas: TableDef<LearningArea, LearningAreaInsert>;
      learning_topics: TableDef<LearningTopic, LearningTopicInsert>;
      learning_sessions: TableDef<LearningSession, LearningSessionInsert>;
      habits: TableDef<Habit, HabitInsert>;
      habit_completions: TableDef<HabitCompletion, HabitCompletionInsert>;
      time_entries: TableDef<TimeEntry, TimeEntryInsert>;
      income: TableDef<Income, IncomeInsert>;
      expenses: TableDef<Expense, ExpenseInsert>;
      emergency_fund: TableDef<EmergencyFund, EmergencyFundInsert>;
      emergency_fund_transactions: TableDef<EmergencyFundTransaction, EmergencyFundTransactionInsert>;
      notes: TableDef<Note, NoteInsert>;
      crm_leads: TableDef<CrmLead, CrmLeadInsert>;
      timeline_events: TableDef<TimelineEvent, TimelineEventInsert>;
      notifications: TableDef<Notification, NotificationInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
