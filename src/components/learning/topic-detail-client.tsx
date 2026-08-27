"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TopicFormModal, type GoalOption } from "@/components/learning/topic-form-modal";
import { SessionFormModal } from "@/components/learning/session-form-modal";
import { EntityNotes } from "@/components/notes/entity-notes";
import { deleteSession, deleteTopic } from "@/lib/actions/learning";
import type { LearningArea, LearningSession } from "@/types/database";
import type { TopicWithStats } from "@/lib/queries/learning";

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function TopicDetailClient({
  topic,
  area,
  sessions,
  goals = [],
}: {
  topic: TopicWithStats;
  area: LearningArea;
  sessions: LearningSession[];
  goals?: GoalOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LearningSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<LearningSession | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/learning/${area.id}`} className="text-xs font-medium text-accent hover:underline">
          ← {area.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{topic.name}</h1>
            <Badge tone="accent">{topic.status}</Badge>
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
      </div>

      <Card>
        <CardHeader title="Overview" />
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted">Progress</span>
            <span className="font-medium">{topic.progress}%</span>
          </div>
          <ProgressBar value={topic.progress} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted">Study time</p>
            <p className="font-medium">{hours(topic.totalMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Confidence</p>
            <p className="font-medium">{topic.confidence != null ? `${topic.confidence}/10` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Sessions</p>
            <p className="font-medium">{topic.sessionCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Started</p>
            <p className="font-medium">{topic.started_at ? new Date(topic.started_at).toLocaleDateString() : "—"}</p>
          </div>
        </div>
        {topic.notes && <p className="mt-4 text-sm text-muted">{topic.notes}</p>}
      </Card>

      <Card>
        <CardHeader
          title="Session history"
          action={
            <button
              type="button"
              onClick={() => {
                setEditingSession(null);
                setSessionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              <Plus size={14} />
              Log Session
            </button>
          }
        />
        {sessions.length === 0 ? (
          <EmptyState icon={History} title="No sessions yet" description="Log your first study session for this topic." />
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{session.date}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{(session.duration_minutes / 60).toFixed(1)}h</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSession(session);
                        setSessionModalOpen(true);
                      }}
                      className="text-muted hover:text-foreground"
                      aria-label="Edit session"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSession(session)}
                      className="text-muted hover:text-danger"
                      aria-label="Delete session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {session.what_learned && <p className="mt-1 text-sm">{session.what_learned}</p>}
                {(session.confidence_before != null || session.confidence_after != null) && (
                  <p className="mt-1 text-xs text-muted">
                    Confidence: {session.confidence_before ?? "—"} → {session.confidence_after ?? "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <EntityNotes topicId={topic.id} topicLabel={topic.name} />
      </Card>

      <TopicFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        areaId={area.id}
        topic={topic}
        goals={goals}
      />

      <SessionFormModal
        key={editingSession?.id ?? "new"}
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        topicId={topic.id}
        areaId={area.id}
        session={editingSession}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete topic"
        description={`Delete "${topic.name}"? This also deletes its session history. This can't be undone.`}
        onConfirm={async () => {
          await deleteTopic(topic.id, area.id);
          router.push(`/learning/${area.id}`);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingSession)}
        onClose={() => setDeletingSession(null)}
        title="Delete session"
        description="Delete this study session? This can't be undone."
        onConfirm={async () => {
          if (deletingSession) {
            await deleteSession(deletingSession.id, area.id, topic.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
