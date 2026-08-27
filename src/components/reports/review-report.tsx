"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ReportRangeHeader } from "@/components/reports/report-range-header";
import { generateWeeklyReviewNarrative, generateMonthlyReviewNarrative } from "@/lib/actions/ai";
import type { WeeklyReviewData, MonthlyReviewData } from "@/lib/queries/review";
import type { DateRangePreset } from "@/lib/date-ranges";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function ReviewReport({
  data,
  kind,
  range,
}: {
  data: WeeklyReviewData | MonthlyReviewData;
  kind: "weekly" | "monthly";
  range: DateRangePreset;
}) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthly = kind === "monthly" ? (data as MonthlyReviewData) : null;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const result =
        kind === "weekly" ? await generateWeeklyReviewNarrative(data) : await generateMonthlyReviewNarrative(data);
      if (result.ok) setNarrative(result.text);
      else setError(result.text);
    } catch {
      setError("AI insights are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportRangeHeader range={range} rangeLabel={data.range.label} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardHeader title={`AI ${kind === "weekly" ? "Weekly" : "Monthly"} Summary`} />
        </div>
        {narrative ? (
          <p className="whitespace-pre-wrap text-sm">{narrative}</p>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Generating…" : "Generate AI summary"}
          </button>
        )}
        <p className="mt-2 text-xs text-muted">AI-generated recommendations, based only on the data below.</p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Accomplishments" />
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Tasks completed</span>
              <span className="font-medium text-success">{data.accomplishments.tasksCompleted}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Projects progressed</span>
              <span className="font-medium">{data.accomplishments.projectsProgressed}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Learning sessions logged</span>
              <span className="font-medium">{data.accomplishments.learningSessionsLogged}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Goals progressed</span>
              <span className="font-medium">{data.accomplishments.goalsProgressed}</span>
            </li>
            {monthly && (
              <li className="flex justify-between">
                <span className="text-muted">Topics completed</span>
                <span className="font-medium">{monthly.topicsCompleted}</span>
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Time" />
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Total hours worked</span>
              <span className="font-medium">{data.time.totalHours.toFixed(1)}h</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Learning hours</span>
              <span className="font-medium">{data.time.learningHours.toFixed(1)}h</span>
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Finance" />
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Revenue (paid)</span>
              <span className="font-medium text-success">{money(data.finance.revenue)} MAD</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Expenses</span>
              <span className="font-medium text-danger">{money(data.finance.expenses)} MAD</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Net income</span>
              <span className={`font-medium ${data.finance.netIncome >= 0 ? "text-success" : "text-danger"}`}>
                {money(data.finance.netIncome)} MAD
              </span>
            </li>
            {monthly && (
              <li className="flex justify-between">
                <span className="text-muted">Avg goal progress</span>
                <span className="font-medium">{monthly.goalProgressAverage}%</span>
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Habits" />
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Completion rate</span>
              <span className="font-medium">{data.habits.completionRate}%</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Strongest</span>
              <span className="font-medium">{data.habits.strongest ?? "—"}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Weakest</span>
              <span className="font-medium">{data.habits.weakest ?? "—"}</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Problems" />
        {data.problems.overdueTasks === 0 &&
        data.problems.stalledProjects.length === 0 &&
        data.problems.inconsistentHabits.length === 0 &&
        (data.problems.learningDeclinePercent ?? 0) >= 0 ? (
          <p className="text-sm text-muted">No issues detected.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.problems.overdueTasks > 0 && (
              <li className="text-danger">{data.problems.overdueTasks} overdue task(s).</li>
            )}
            {data.problems.stalledProjects.map((p) => (
              <li key={p} className="text-warning">
                Stalled project: {p}
              </li>
            ))}
            {data.problems.inconsistentHabits.map((h) => (
              <li key={h} className="text-warning">
                Inconsistent habit: {h}
              </li>
            ))}
            {data.problems.learningDeclinePercent != null && data.problems.learningDeclinePercent < 0 && (
              <li className="text-warning">Learning activity down {Math.abs(data.problems.learningDeclinePercent)}% vs. the prior period.</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
