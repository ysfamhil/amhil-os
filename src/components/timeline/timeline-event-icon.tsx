import {
  CheckCircle2,
  ListPlus,
  FolderPlus,
  FolderCheck,
  RefreshCw,
  GraduationCap,
  BookOpenCheck,
  Repeat,
  Flame,
  Clock,
  Target,
  UserPlus,
  TrendingUp,
  Trophy,
  XCircle,
  Wallet,
  Receipt,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { Badge } from "@/components/ui/badge";

type BadgeTone = Parameters<typeof Badge>[0]["tone"];

const EVENT_ICON: Record<string, LucideIcon> = {
  task_created: ListPlus,
  task_completed: CheckCircle2,
  project_created: FolderPlus,
  project_completed: FolderCheck,
  project_status_changed: RefreshCw,
  learning_session_logged: GraduationCap,
  learning_topic_completed: BookOpenCheck,
  habit_completed: Repeat,
  habit_milestone: Flame,
  time_entry_created: Clock,
  goal_completed: Target,
  client_created: UserPlus,
  lead_created: TrendingUp,
  lead_won: Trophy,
  lead_lost: XCircle,
  income_received: Wallet,
  expense_added: Receipt,
  note_created: StickyNote,
};

const EVENT_TONE: Record<string, BadgeTone> = {
  task_completed: "success",
  project_completed: "success",
  learning_topic_completed: "success",
  habit_completed: "success",
  habit_milestone: "warning",
  goal_completed: "success",
  lead_won: "success",
  lead_lost: "danger",
  income_received: "success",
  expense_added: "danger",
};

export function TimelineEventIcon({ eventType }: { eventType: string }) {
  const Icon = EVENT_ICON[eventType] ?? ListPlus;
  const tone = EVENT_TONE[eventType] ?? "neutral";
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "danger"
        ? "bg-danger/15 text-danger"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-border/50 text-muted";

  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
      <Icon size={16} />
    </span>
  );
}
