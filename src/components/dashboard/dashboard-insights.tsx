import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { DashboardData } from "@/lib/dashboard";

/**
 * Deliberately zero AI calls here — every line is plain arithmetic over data
 * the dashboard already fetched. Matches the phase spec's cost-control rule
 * (never call an AI API for basic counts) and its graceful-degradation rule
 * (the dashboard must still work with AI fully unavailable).
 */
export function DashboardInsights({ data }: { data: DashboardData }) {
  const insights: string[] = [];

  const overdueCount = data.today.overdueTasks.length;
  if (overdueCount > 0) {
    insights.push(`You have ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}.`);
  }

  if (data.week.learningHours > 0) {
    const h = Math.floor(data.week.learningHours);
    const m = Math.round((data.week.learningHours - h) * 60);
    insights.push(`You studied ${h}h ${m}m this week.`);
  }

  if (data.leads.open > 0) {
    insights.push(`${data.leads.open} lead${data.leads.open === 1 ? "" : "s"} still open in your pipeline.`);
  }

  if (data.finance.monthRevenue > 0) {
    insights.push(`${data.finance.monthRevenue.toLocaleString()} MAD in paid revenue this month.`);
  }

  if (data.habitsToday.total > 0) {
    insights.push(`${data.habitsToday.completed}/${data.habitsToday.total} habits completed today.`);
  }

  if (insights.length === 0) {
    insights.push("Nothing notable to flag right now — you're all caught up.");
  }

  return (
    <Card>
      <CardHeader title="Insights" />
      <ul className="flex flex-col gap-2">
        {insights.slice(0, 4).map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
