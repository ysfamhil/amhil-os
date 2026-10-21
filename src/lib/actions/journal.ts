"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isJournalMood, isValidISODate } from "@/lib/journal";
import type { JournalMood } from "@/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface JournalEntryInput {
  entry_date: string;
  title: string;
  story: string;
  mood: JournalMood | null;
  highlights: string;
  challenges: string;
  lessons: string;
  tomorrow_focus: string;
}

// Generous ceiling so a runaway paste can't bloat the row; far above any real day of writing.
const MAX_FIELD_LENGTH = 200_000;

function revalidateJournalPaths() {
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}

function clean(value: string | null | undefined, label: string): string | null {
  const text = value ?? "";
  if (text.length > MAX_FIELD_LENGTH) throw new Error(`${label} is too long`);
  // Keep the writer's own spacing; only treat whitespace-only as empty.
  return text.trim() === "" ? null : text;
}

/**
 * Autosave target: creates the day's entry on first save and updates it after
 * that (one entry per user per day). Saving a completely empty entry removes
 * it instead of leaving a blank row that would count as a journaled day.
 */
export async function saveJournalEntry(input: JournalEntryInput): Promise<{ saved: boolean }> {
  const { supabase, user } = await requireUser();

  if (!isValidISODate(input.entry_date)) throw new Error("Invalid date");
  if (input.mood !== null && !isJournalMood(input.mood)) throw new Error("Invalid mood");

  const fields = {
    title: clean(input.title, "Title"),
    story: clean(input.story, "Story"),
    highlights: clean(input.highlights, "Highlights"),
    challenges: clean(input.challenges, "Challenges"),
    lessons: clean(input.lessons, "Lessons"),
    tomorrow_focus: clean(input.tomorrow_focus, "Tomorrow's focus"),
  };
  const isEmpty = Object.values(fields).every((value) => value === null) && input.mood === null;

  if (isEmpty) {
    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("entry_date", input.entry_date);
    if (error) throw new Error(error.message);
    revalidateJournalPaths();
    return { saved: false };
  }

  const { error } = await supabase.from("journal_entries").upsert(
    {
      user_id: user.id,
      entry_date: input.entry_date,
      mood: input.mood,
      ...fields,
    },
    { onConflict: "user_id,entry_date" }
  );
  if (error) throw new Error(error.message);

  revalidateJournalPaths();
  return { saved: true };
}

export async function deleteJournalEntry(entryDate: string) {
  const { supabase, user } = await requireUser();
  if (!isValidISODate(entryDate)) throw new Error("Invalid date");

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("entry_date", entryDate);
  if (error) throw new Error(error.message);
  revalidateJournalPaths();
}
