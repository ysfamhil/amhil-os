"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AreaFormModal } from "@/components/learning/area-form-modal";
import { TopicFormModal, type GoalOption } from "@/components/learning/topic-form-modal";
import { deleteArea } from "@/lib/actions/learning";
import type { LearningArea } from "@/types/database";
import type { TopicWithStats } from "@/lib/queries/learning";

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function AreaDetailClient({
  area,
  topics,
  goals = [],
}: {
  area: LearningArea;
  topics: TopicWithStats[];
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{area.name}</h1>
          {area.description && <p className="mt-1 text-sm text-muted">{area.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Topics</h2>
        <button
          type="button"
          onClick={() => setTopicModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={14} />
          New Topic
        </button>
      </div>

      {topics.length === 0 ? (
        <EmptyState icon={BookOpen} title="No topics yet" description="Break this area down into topics to track." />
      ) : (
        <div className="flex flex-col gap-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/learning/${area.id}/topics/${topic.id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{topic.name}</span>
                      <Badge tone="neutral">{topic.status}</Badge>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={topic.progress} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    <p>{topic.progress}%</p>
                    <p>{hours(topic.totalMinutes)}</p>
                    {topic.confidence != null && <p>Confidence {topic.confidence}/10</p>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <AreaFormModal open={editOpen} onClose={() => setEditOpen(false)} area={area} />

      <TopicFormModal open={topicModalOpen} onClose={() => setTopicModalOpen(false)} areaId={area.id} goals={goals} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete area"
        description={`Delete "${area.name}"? This also deletes all its topics and study session history. This can't be undone.`}
        onConfirm={async () => {
          await deleteArea(area.id);
          router.push("/learning");
          router.refresh();
        }}
      />
    </div>
  );
}
