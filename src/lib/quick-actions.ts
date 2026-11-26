import { ListPlus, Clock, Repeat, Target, Wallet, Receipt, StickyNote, type LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Task", href: "/app/tasks?new=1", icon: ListPlus },
  { label: "Log Time", href: "/app/time?new=1", icon: Clock },
  { label: "Complete Habit", href: "/app/habits", icon: Repeat },
  { label: "New Goal", href: "/app/goals?new=1", icon: Target },
  { label: "Add Income", href: "/app/finance?tab=income&new=1", icon: Wallet },
  { label: "Add Expense", href: "/app/finance?tab=expenses&new=1", icon: Receipt },
  { label: "Add Note", href: "/app/notes?new=1", icon: StickyNote },
];
