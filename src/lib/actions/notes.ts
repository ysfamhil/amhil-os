"use server";

import { sanitizeNoteHtml } from "@/lib/note-html";
import { revalidatePath } from "next/cache";
import { requireApprovedSession } from "@/lib/auth";
import { logTimelineEvent } from "@/lib/timeline";
import { getNotes, type NoteFilters, type NoteWithRelations } from "@/lib/queries/notes";
import { NOTE_FIELDS, RELATIONS, assertOwnedRelations, assertUuid, pickWritable } from "@/lib/write-fields";

export interface NoteInput {
  title: string;
  content?: string | null;
  tags?: string[];
  project_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  learning_topic_id?: string | null;
  goal_id?: string | null;
}

function revalidateNotePaths() {
  revalidatePath("/notes");
  revalidatePath("/dashboard");
}

/** Tags are stored as text[]; refuse anything else instead of letting the database coerce it. */
function assertTags(tags: unknown): asserts tags is string[] {
  if (!Array.isArray(tags) || tags.length > 100 || tags.some((tag) => typeof tag !== "string" || tag.length > 200)) {
    throw new Error("Tags must be a list of short text values");
  }
}

export async function createNote(input: NoteInput) {
  const { supabase, user } = await requireApprovedSession();
  const fields = pickWritable(NOTE_FIELDS, input);
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  if (!title) throw new Error("Title is required");
  if (fields.tags !== undefined) assertTags(fields.tags);

  // A note's own RLS policy only checks that the note row itself belongs to the caller; it says
  // nothing about whether a project_id/task_id/etc. the caller supplies belongs to them too.
  await assertOwnedRelations(supabase, user.id, RELATIONS.notes, fields);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      title,
      content: fields.content == null ? null : sanitizeNoteHtml(String(fields.content)),
      tags: fields.tags ?? [],
      project_id: fields.project_id || null,
      client_id: fields.client_id || null,
      task_id: fields.task_id || null,
      learning_topic_id: fields.learning_topic_id || null,
      goal_id: fields.goal_id || null,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logTimelineEvent(supabase, user.id, {
    eventType: "note_created",
    title: `New note: "${title}"`,
    relatedEntityType: "note",
    relatedEntityId: data.id,
    projectId: fields.project_id || null,
  });

  revalidateNotePaths();
  return data;
}

export async function updateNote(id: string, input: Partial<NoteInput>) {
  const { supabase, user } = await requireApprovedSession();
  assertUuid(id, "Note");
  const fields = pickWritable(NOTE_FIELDS, input);
  if (fields.tags !== undefined) assertTags(fields.tags);

  await assertOwnedRelations(supabase, user.id, RELATIONS.notes, fields);

  const patch = { ...fields };
  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("Title is required");
    patch.title = title;
  }
  if ("project_id" in fields) patch.project_id = fields.project_id || null;
  if ("client_id" in fields) patch.client_id = fields.client_id || null;
  if ("task_id" in fields) patch.task_id = fields.task_id || null;
  if ("learning_topic_id" in fields) patch.learning_topic_id = fields.learning_topic_id || null;
  if ("goal_id" in fields) patch.goal_id = fields.goal_id || null;

  if (patch.content != null) patch.content = sanitizeNoteHtml(String(patch.content));

  const { error } = await supabase.from("notes").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateNotePaths();
}

export async function deleteNote(id: string) {
  const { supabase, user } = await requireApprovedSession();
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidateNotePaths();
}

/** Used by the small notes widget embedded on task/topic/goal/project/client
 * detail views — scoped to exactly one relation at a time. */
export async function getNotesForRelation(filters: NoteFilters): Promise<NoteWithRelations[]> {
  const { supabase, user } = await requireApprovedSession();
  return getNotes(supabase, user.id, filters);
}
