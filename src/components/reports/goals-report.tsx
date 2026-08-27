import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { GoalsReport as GoalsReportData } from "@/lib/queries/reports";

export function GoalsReport({ data }: { data: GoalsReportData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Active goals</p>
          <p className="mt-1 text-lg font-semibold">{data.active}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Completed goals</p>
          <p className="mt-1 text-lg font-semibold text-success">{data.completed}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Nearing deadline</p>
          <p className="mt-1 text-lg font-semibold">{data.nearingDeadline.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Goals by category" />
          {data.byCategory.length === 0 ? (
            <p className="text-sm text-muted">No goals yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.byCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="text-muted">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Nearing deadline" />
          {data.nearingDeadline.length === 0 ? (
            <p className="text-sm text-muted">Nothing due in the next two weeks.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.nearingDeadline.map((g) => (
                <li key={g.id}>
                  <Link href={`/goals/${g.id}`} className="mb-1 flex items-center justify-between text-sm hover:underline">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-xs text-warning">{g.target_date}</span>
                  </Link>
                  <ProgressBar value={g.progress} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="All goals" />
        {data.goals.length === 0 ? (
          <p className="text-sm text-muted">No goals yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {data.goals.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-border/20">
                <span className="min-w-0 truncate font-medium">{g.title}</span>
                <span className="w-32 shrink-0">
                  <ProgressBar value={g.progress} />
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-muted">{g.progress}%</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
