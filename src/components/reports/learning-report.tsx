import { Card, CardHeader } from "@/components/ui/card";
import { ReportRangeHeader } from "@/components/reports/report-range-header";
import { TrendBarChart } from "@/components/reports/trend-bar-chart";
import type { LearningReport as LearningReportData } from "@/lib/queries/reports";
import type { DateRangePreset } from "@/lib/date-ranges";

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

export function LearningReport({
  range,
  rangeLabel,
  data,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  data: LearningReportData;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ReportRangeHeader range={range} rangeLabel={rangeLabel} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs text-muted">Total hours</p>
          <p className="mt-1 text-lg font-semibold">{hours(data.totalHours)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Sessions</p>
          <p className="mt-1 text-lg font-semibold">{data.sessionCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Topics completed</p>
          <p className="mt-1 text-lg font-semibold text-success">{data.topicsCompleted}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Currently learning</p>
          <p className="mt-1 text-lg font-semibold">{data.topicsInProgress}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Avg confidence</p>
          <p className="mt-1 text-lg font-semibold">{data.averageConfidence != null ? data.averageConfidence.toFixed(1) : "—"}/10</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Learning velocity</p>
          <p className="mt-1 text-lg font-semibold">{data.velocityHoursPerWeek}h / week</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Topic completion rate</p>
          <p className="mt-1 text-lg font-semibold">{data.topicCompletionRate != null ? `${data.topicCompletionRate}%` : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Consistency</p>
          <p className="mt-1 text-lg font-semibold">{data.consistencyPercent}% of days</p>
        </Card>
      </div>

      {data.confidenceChange != null && (
        <p className="text-xs text-muted">
          Confidence moved by an average of{" "}
          <span className={data.confidenceChange >= 0 ? "text-success" : "text-danger"}>
            {data.confidenceChange >= 0 ? "+" : ""}
            {data.confidenceChange.toFixed(1)}
          </span>{" "}
          per session logged in this period.
        </p>
      )}

      <Card>
        <CardHeader title="Learning hours over time" />
        {data.trend.every((p) => p.count === 0) ? (
          <p className="text-sm text-muted">No sessions logged in this period.</p>
        ) : (
          <TrendBarChart data={data.trend} />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Learning by area" />
          {data.byArea.length === 0 ? (
            <p className="text-sm text-muted">No sessions logged in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.byArea.map((a) => (
                <li key={a.name} className="flex items-center justify-between text-sm">
                  <span>{a.name}</span>
                  <span className="text-muted">{hours(a.hours)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Progress by topic" />
          {data.byTopic.length === 0 ? (
            <p className="text-sm text-muted">No sessions logged in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.byTopic.map((t) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span>
                    {t.name} <span className="text-xs text-muted">— {t.areaName}</span>
                  </span>
                  <span className="text-muted">
                    {hours(t.hours)} · {t.progress}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
