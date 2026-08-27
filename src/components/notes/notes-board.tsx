"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StickyNote, Plus } from "lucide-react";
import { NoteCard } from "@/components/notes/note-card";
import { NoteFormModal, type RelationOption } from "@/components/notes/note-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteNote } from "@/lib/actions/notes";
import type { NoteWithRelations } from "@/lib/queries/notes";

export function NotesBoard({
  notes,
  projects,
  clients,
  tasks = [],
  topics = [],
  goals = [],
}: {
  notes: NoteWithRelations[];
  projects: RelationOption[];
  clients: RelationOption[];
  tasks?: RelationOption[];
  topics?: RelationOption[];
  goals?: RelationOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingNote, setEditingNote] = useState<NoteWithRelations | null>(null);
  const [deletingNote, setDeletingNote] = useState<NoteWithRelations | null>(null);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value || null }), 300);
  }

  function openNew() {
    setEditingNote(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search notes…"
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={openNew}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          description="Jot down anything worth remembering — optionally linked to a project, client, task, learning topic, or goal."
          action={
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Note
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => {
                setEditingNote(note);
                setModalOpen(true);
              }}
              onDelete={() => setDeletingNote(note)}
            />
          ))}
        </div>
      )}

      <NoteFormModal
        key={editingNote?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        note={editingNote}
        projects={projects}
        clients={clients}
        tasks={tasks}
        topics={topics}
        goals={goals}
      />

      <ConfirmDialog
        open={Boolean(deletingNote)}
        onClose={() => setDeletingNote(null)}
        title="Delete note"
        description={`Delete "${deletingNote?.title}"? This can't be undone.`}
        onConfirm={async () => {
          if (deletingNote) {
            await deleteNote(deletingNote.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
