"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCap, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaCard } from "@/components/learning/area-card";
import { AreaFormModal } from "@/components/learning/area-form-modal";
import type { AreaWithStats } from "@/lib/queries/learning";
import type { LearningOverview } from "@/lib/queries/learning";

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function LearningOverviewClient({
  areas,
  overview,
}: {
  areas: AreaWithStats[];
  overview: LearningOverview;
}) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total study time</p>
          <p className="mt-1 text-lg font-semibold">{hours(overview.totalMinutes)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">This week</p>
          <p className="mt-1 text-lg font-semibold">{hours(overview.weekMinutes)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">This month</p>
          <p className="mt-1 text-lg font-semibold">{hours(overview.monthMinutes)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Areas</p>
          <p className="mt-1 text-lg font-semibold">{areas.length}</p>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Learning Areas</h2>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus size={14} />
            New Area
          </button>
        </div>

        {areas.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No learning areas yet"
            description="Create an area like Odoo or Web Development, then add topics under it."
            action={
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                New Area
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <AreaCard key={area.id} area={area} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Active Topics" />
          {overview.activeTopics.length === 0 ? (
            <p className="text-sm text-muted">Nothing in progress right now.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {overview.activeTopics.map((topic) => (
                <li key={topic.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{topic.name}</span>
                    <span className="text-xs text-muted">{topic.progress}%</span>
                  </div>
                  <ProgressBar value={topic.progress} />
                  <p className="mt-1 text-xs text-muted">{topic.areaName}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently Studied" />
          {overview.recentSessions.length === 0 ? (
            <p className="text-sm text-muted">No sessions logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {overview.recentSessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span>{session.topicName}</span>
                    <span className="ml-2 text-xs text-muted">{session.areaName}</span>
                  </div>
                  <Badge tone="neutral">{(session.duration_minutes / 60).toFixed(1)}h</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AreaFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
