import { ListPlus, Clock, Repeat, Target, Wallet, Receipt, StickyNote, type LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Task", href: "/tasks?new=1", icon: ListPlus },
  { label: "Log Time", href: "/time?new=1", icon: Clock },
  { label: "Complete Habit", href: "/habits", icon: Repeat },
  { label: "New Goal", href: "/goals?new=1", icon: Target },
  { label: "Add Income", href: "/finance?tab=income&new=1", icon: Wallet },
  { label: "Add Expense", href: "/finance?tab=expenses&new=1", icon: Receipt },
  { label: "Add Note", href: "/notes?new=1", icon: StickyNote },
];
