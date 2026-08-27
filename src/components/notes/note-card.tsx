"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NoteWithRelations } from "@/lib/queries/notes";

export function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: NoteWithRelations;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{note.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit note"
            className="rounded-lg p-1.5 text-muted hover:bg-border/40 hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete note"
            className="rounded-lg p-1.5 text-muted hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {note.content && <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted">{note.content}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {note.projects && <Badge tone="accent">{note.projects.name}</Badge>}
        {note.clients && <Badge tone="neutral">{note.clients.name}</Badge>}
        {note.tasks && <Badge tone="neutral">{note.tasks.title}</Badge>}
        {note.learning_topics && <Badge tone="neutral">{note.learning_topics.name}</Badge>}
        {note.goals && <Badge tone="neutral">{note.goals.title}</Badge>}
        {note.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            #{tag}
          </Badge>
        ))}
      </div>

      <p className="mt-1 text-xs text-muted">
        {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </Card>
  );
}
