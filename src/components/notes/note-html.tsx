import { sanitizeNoteHtml } from "@/lib/note-html";

export function NoteHtml({ content, className }: { content: string; className?: string }) {
  return <div data-note-html="" className={className} dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(content) }} />;
}
