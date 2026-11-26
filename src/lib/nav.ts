import {
  LayoutDashboard,
  ListTodo,
  Repeat,
  Target,
  Clock,
  StickyNote,
  BookOpen,
  Wallet,
  Handshake,
  ShieldCheck,
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
  { label: "Overview", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/app/tasks", icon: ListTodo, domainVar: "--domain-tasks" },
  { label: "Habits", href: "/app/habits", icon: Repeat, domainVar: "--domain-habits" },
  { label: "Goals", href: "/app/goals", icon: Target, domainVar: "--domain-goals" },
  { label: "Timesheet", href: "/app/time", icon: Clock, domainVar: "--domain-time" },
  { label: "Notes", href: "/app/notes", icon: StickyNote, domainVar: "--domain-notes" },
  { label: "Journal", href: "/app/journal", icon: BookOpen, domainVar: "--domain-journal" },
  { label: "Finance", href: "/app/finance", icon: Wallet, domainVar: "--domain-finance" },
  { label: "CRM", href: "/app/crm", icon: Handshake, domainVar: "--domain-crm" },
];

/** Only ever rendered for role = "admin" — see AppHeader. */
export const ADMIN_NAV_ITEM: NavItem = { label: "Admin", href: "/app/admin", icon: ShieldCheck };
