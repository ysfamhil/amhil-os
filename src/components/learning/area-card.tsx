import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { AreaWithStats } from "@/lib/queries/learning";

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function AreaCard({ area }: { area: AreaWithStats }) {
  return (
    <Link href={`/learning/${area.id}`}>
      <Card className="flex h-full flex-col gap-2 transition-colors hover:border-accent/50">
        <h3 className="font-medium">{area.name}</h3>
        {area.description && <p className="line-clamp-2 text-sm text-muted">{area.description}</p>}
        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <span>
            {area.topicCount} topic{area.topicCount === 1 ? "" : "s"} · {area.activeTopicCount} active
          </span>
          <span>{hours(area.totalMinutes)} studied</span>
        </div>
      </Card>
    </Link>
  );
}
