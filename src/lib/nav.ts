import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  GraduationCap,
  Repeat,
  Target,
  Clock,
  Users,
  TrendingUp,
  Wallet,
  History,
  BarChart3,
  Search,
  Sparkles,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Learning", href: "/learning", icon: GraduationCap },
  { label: "Habits", href: "/habits", icon: Repeat },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Time", href: "/time", icon: Clock },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Leads", href: "/leads", icon: TrendingUp },
  { label: "Finance", href: "/finance", icon: Wallet },
  { label: "Timeline", href: "/timeline", icon: History },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "AI Assistant", href: "/ai", icon: Sparkles },
  { label: "Search", href: "/search", icon: Search },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];
