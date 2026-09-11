"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoteFormModal } from "@/components/notes/note-form-modal";
import { deleteNote, getNotesForRelation } from "@/lib/actions/notes";
import type { NoteWithRelations } from "@/lib/queries/notes";

/**
 * A small, self-contained "notes on this record" widget — reuses the same
 * notes table, NoteFormModal, and createNote/updateNote/deleteNote actions
 * as the standalone /notes page rather than a second note system. Exactly
 * one of the id props should be passed by the caller; that's the relation
 * this instance is scoped to.
 */
export function EntityNotes({
  taskId,
  taskLabel,
  goalId,
  goalLabel,
}: {
  taskId?: string;
  taskLabel?: string;
  goalId?: string;
  goalLabel?: string;
}) {
  const [notes, setNotes] = useState<NoteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteWithRelations | null>(null);
  const [deletingNote, setDeletingNote] = useState<NoteWithRelations | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getNotesForRelation({ taskId, goalId });
      setNotes(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching notes for this record on mount/relation change
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, goalId]);

  function openNew() {
    setEditingNote(null);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-border/40"
        >
          <Plus size={12} />
          Note
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Jot down anything worth remembering about this." />
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{note.title}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNote(note);
                      setModalOpen(true);
                    }}
                    aria-label="Edit note"
                    className="text-muted hover:text-foreground"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingNote(note)}
                    aria-label="Delete note"
                    className="text-muted hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {note.content && (
                <div
                  className="mt-1 line-clamp-2 text-sm text-muted [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <NoteFormModal
        key={editingNote?.id ?? "new"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          load();
        }}
        note={editingNote}
        tasks={taskId && taskLabel ? [{ id: taskId, name: taskLabel }] : []}
        goals={goalId && goalLabel ? [{ id: goalId, name: goalLabel }] : []}
        defaultTaskId={taskId}
        defaultGoalId={goalId}
      />

      <ConfirmDialog
        open={Boolean(deletingNote)}
        onClose={() => setDeletingNote(null)}
        title="Delete note"
        description={`Delete "${deletingNote?.title}"? This can't be undone.`}
        onConfirm={async () => {
          if (deletingNote) {
            await deleteNote(deletingNote.id);
            await load();
          }
        }}
      />
    </div>
  );
}
