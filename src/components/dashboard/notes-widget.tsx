"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import type { DashboardData } from "@/lib/dashboard";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotesWidget({ data, onAddNote }: { data: DashboardData; onAddNote: () => void }) {
  const router = useRouter();
  const notes = data.notes.recent;

  return (
    <WidgetShell
      title="Notes"
      action={
        <div className="flex items-center gap-1">
          <Link href="/notes" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
            View all
          </Link>
          <WidgetAddButton onClick={onAddNote} label="Note" domain="notes" />
        </div>
      }
      domain="notes"
      className="h-full"
      bodyClassName="px-[16px] py-[13px]"
    >
      {notes.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12.5px] text-t6">No notes yet.</p>
          <button type="button" onClick={onAddNote} className="text-[12px] font-bold" style={{ color: "var(--domain-notes)" }}>
            + Add a note
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => router.push(`/notes?q=${encodeURIComponent(note.title)}`)}
                className="min-w-0 w-full text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{note.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-t7">{formatDate(note.created_at)}</span>
                </div>
                {note.content && (
                  <div
                    className="mt-0.5 line-clamp-2 text-[11.5px] text-t6 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                    dangerouslySetInnerHTML={{ __html: note.content }}
                  />
                )}
                {note.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {note.tags.map((tag) => (
                      <Badge key={tag} tone="notes">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
