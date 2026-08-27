import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HabitsReport as HabitsReportData } from "@/lib/queries/reports";

export function HabitsReport({ data }: { data: HabitsReportData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Overall completion rate</p>
          <p className="mt-1 text-lg font-semibold">{data.overallCompletionRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Most consistent</p>
          <p className="mt-1 text-lg font-semibold">{data.mostConsistent ? data.mostConsistent.name : "—"}</p>
          {data.mostConsistent && <p className="text-xs text-muted">{data.mostConsistent.weeklyConsistency}% this week</p>}
        </Card>
        <Card>
          <p className="text-xs text-muted">Least consistent</p>
          <p className="mt-1 text-lg font-semibold">{data.leastConsistent ? data.leastConsistent.name : "—"}</p>
          {data.leastConsistent && <p className="text-xs text-muted">{data.leastConsistent.weeklyConsistency}% this week</p>}
        </Card>
      </div>

      <Card>
        <CardHeader title="Habits" />
        {data.habits.length === 0 ? (
          <p className="text-sm text-muted">No habits yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {data.habits.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{h.name}</span>
                  {!h.is_active && <Badge tone="neutral">Archived</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span>🔥 {h.currentStreak}d streak</span>
                  <span>Best {h.bestStreak}d</span>
                  <span>Week {h.weeklyConsistency}%</span>
                  <span>Month {h.monthlyConsistency}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
