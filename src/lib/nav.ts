import {
  LayoutDashboard,
  ListTodo,
  Repeat,
  Target,
  Clock,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** CSS var name (without var()) for this domain's color — omitted for
   * Overview, which is the aggregate view and uses the neutral brand accent. */
  domainVar?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo, domainVar: "--domain-tasks" },
  { label: "Habits", href: "/habits", icon: Repeat, domainVar: "--domain-habits" },
  { label: "Goals", href: "/goals", icon: Target, domainVar: "--domain-goals" },
  { label: "Timesheet", href: "/time", icon: Clock, domainVar: "--domain-time" },
  { label: "Notes", href: "/notes", icon: StickyNote, domainVar: "--domain-notes" },
  { label: "Finance", href: "/finance", icon: Wallet, domainVar: "--domain-finance" },
];
