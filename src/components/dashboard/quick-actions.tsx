import Link from "next/link";
import {
  ListPlus,
  FolderPlus,
  Clock,
  GraduationCap,
  Repeat,
  Wallet,
  Receipt,
  StickyNote,
  Target,
  Users,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

const ACTIONS = [
  { label: "New Task", href: "/tasks?new=1", icon: ListPlus },
  { label: "New Project", href: "/projects?new=1", icon: FolderPlus },
  { label: "Log Time", href: "/time?new=1", icon: Clock },
  { label: "Log Learning", href: "/learning", icon: GraduationCap },
  { label: "Complete Habit", href: "/habits", icon: Repeat },
  { label: "New Goal", href: "/goals?new=1", icon: Target },
  { label: "New Client", href: "/clients?new=1", icon: Users },
  { label: "New Lead", href: "/leads?new=1", icon: TrendingUp },
  { label: "Add Income", href: "/finance?tab=income&new=1", icon: Wallet },
  { label: "Add Expense", href: "/finance?tab=expenses&new=1", icon: Receipt },
  { label: "Add Note", href: "/notes?new=1", icon: StickyNote },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-center text-xs font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              <Icon size={18} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
