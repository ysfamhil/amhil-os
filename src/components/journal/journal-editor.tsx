"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Trash2 } from "lucide-react";
import clsx from "clsx";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteJournalEntry, saveJournalEntry } from "@/lib/actions/journal";
import { JOURNAL_MOODS, formatLongDate, wordCount } from "@/lib/journal";
import type { JournalEntry, JournalMood } from "@/types/database";

const AUTOSAVE_DELAY_MS = 1200;

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface Draft {
  title: string;
  story: string;
  mood: JournalMood | null;
  highlights: string;
  challenges: string;
  lessons: string;
  tomorrow_focus: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  story: "",
  mood: null,
  highlights: "",
  challenges: "",
  lessons: "",
  tomorrow_focus: "",
};

function draftFromEntry(entry: JournalEntry | null): Draft {
  if (!entry) return EMPTY_DRAFT;
  return {
    title: entry.title ?? "",
    story: entry.story ?? "",
    mood: entry.mood,
    highlights: entry.highlights ?? "",
    challenges: entry.challenges ?? "",
    lessons: entry.lessons ?? "",
    tomorrow_focus: entry.tomorrow_focus ?? "",
  };
}

const REFLECTIONS = [
  { key: "highlights", label: "Highlights", placeholder: "What went well? Wins, good moments…" },
  { key: "challenges", label: "Challenges", placeholder: "What got in the way?" },
  { key: "lessons", label: "Lessons learned", placeholder: "What would you do differently?" },
  { key: "tomorrow_focus", label: "Tomorrow's focus", placeholder: "What matters most tomorrow?" },
] as const;

function AutoTextarea({
  value,
  onChange,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx("block w-full resize-none overflow-hidden bg-transparent outline-none", className)}
    />
  );
}

function SaveIndicator({
  status,
  savedAt,
  error,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: Date | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 text-[12px] text-t6">
      {status === "saving" && (
        <>
          <Loader2 size={13} className="animate-spin" /> Saving…
        </>
      )}
      {status === "dirty" && <>Unsaved changes…</>}
      {status === "saved" && (
        <>
          <Check size={13} style={{ color: "var(--domain-finance)" }} />
          Saved
          {savedAt && (
            <span className="font-mono text-[10.5px] text-t7">
              {savedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </>
      )}
      {status === "error" && (
        <>
          <span className="text-danger">{error ?? "Couldn't save"}</span>
          <button type="button" onClick={onRetry} className="font-semibold text-foreground underline underline-offset-2">
            Retry
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Autosaving editor for one day. The parent keys it by date, so all state here
 * belongs to a single entry; refreshed server props are deliberately ignored
 * after mount so a background revalidation can never overwrite what's being typed.
 */
export function JournalEditor({
  date,
  entry,
  isToday,
}: {
  date: string;
  entry: JournalEntry | null;
  isToday: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromEntry(entry));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasEntry, setHasEntry] = useState(Boolean(entry));
  const [showReflections, setShowReflections] = useState(() => {
    const d = draftFromEntry(entry);
    return Boolean(d.highlights || d.challenges || d.lessons || d.tomorrow_focus);
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(
    async function run(): Promise<void> {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (savingRef.current || !dirtyRef.current) return;

      savingRef.current = true;
      dirtyRef.current = false;
      setStatus("saving");

      let failed = false;
      try {
        const result = await saveJournalEntry({ entry_date: date, ...draftRef.current });
        setHasEntry(result.saved);
        setSavedAt(new Date());
      } catch (err) {
        failed = true;
        dirtyRef.current = true;
        setErrorMsg(err instanceof Error ? err.message : "Couldn't save");
        setStatus("error");
      } finally {
        savingRef.current = false;
      }

      if (failed) return;
      if (dirtyRef.current) void run(); // typed while the save was in flight
      else setStatus("saved");
    },
    [date]
  );

  function update(patch: Partial<Draft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    dirtyRef.current = true;
    setDraft(next);
    setStatus("dirty");
    setErrorMsg(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  // Never lose writing: save on tab hide, warn on close while unsaved, and
  // flush when the editor unmounts (switching to another day).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  async function handleDelete() {
    // Stop autosave from re-creating the entry mid-delete; restore if the delete fails.
    const wasDirty = dirtyRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    dirtyRef.current = false;
    try {
      await deleteJournalEntry(date);
    } catch (err) {
      dirtyRef.current = wasDirty;
      throw err;
    }
    draftRef.current = EMPTY_DRAFT;
    setDraft(EMPTY_DRAFT);
    setHasEntry(false);
    setShowReflections(false);
    setStatus("idle");
  }

  const words = wordCount(draft.story);

  return (
    <article
      className="rounded-[18px] border border-line bg-surface p-5 shadow-card md:p-8"
      style={{ boxShadow: "inset 0 3px 0 0 var(--domain-journal)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-t4">{formatLongDate(date)}</h2>
          {isToday && (
            <span
              className="rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
              style={{
                backgroundColor: "color-mix(in srgb, var(--domain-journal) 16%, transparent)",
                color: "var(--domain-journal)",
              }}
            >
              Today
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator status={status} savedAt={savedAt} error={errorMsg} onRetry={() => void flush()} />
          {hasEntry && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={status === "saving"}
              aria-label="Delete this entry"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-t6 hover:bg-surface2 hover:text-danger disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </header>

      <input
        type="text"
        value={draft.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Give this day a title…"
        aria-label="Entry title"
        maxLength={200}
        className="mt-4 block w-full bg-transparent text-[26px] font-extrabold leading-tight tracking-[-0.02em] outline-none placeholder:text-t8 md:text-[30px]"
      />

      <AutoTextarea
        value={draft.story}
        onChange={(story) => update({ story })}
        placeholder="What happened today? Write as much as you like…"
        aria-label="Daily story"
        className="mt-4 min-h-[32vh] md:min-h-[42vh] text-[16px] leading-[1.75] placeholder:text-t8"
      />

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <span className="mr-1 text-[12px] font-semibold text-t5">How did the day feel?</span>
        {JOURNAL_MOODS.map((mood) => {
          const active = draft.mood === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              aria-pressed={active}
              onClick={() => update({ mood: active ? null : mood.value })}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-[5px] text-[12px] font-medium transition-colors",
                active ? "text-foreground" : "border-line3 text-t4 hover:border-line5 hover:text-foreground"
              )}
              style={
                active
                  ? {
                      borderColor: mood.color,
                      backgroundColor: `color-mix(in srgb, ${mood.color} 16%, transparent)`,
                    }
                  : undefined
              }
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: mood.color }} />
              {mood.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowReflections((open) => !open)}
          aria-expanded={showReflections}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-t4 hover:text-foreground"
        >
          <ChevronDown size={15} className={clsx("transition-transform", !showReflections && "-rotate-90")} />
          Reflections <span className="font-normal text-t7">(optional)</span>
        </button>

        {showReflections && (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {REFLECTIONS.map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label htmlFor={`journal-${key}`} className="text-[12px] font-semibold text-t4">
                  {label}
                </label>
                <AutoTextarea
                  id={`journal-${key}`}
                  value={draft[key]}
                  onChange={(value) => update({ [key]: value })}
                  placeholder={placeholder}
                  rows={3}
                  className="rounded-lg border border-line bg-background px-3 py-2 text-[14px] leading-relaxed placeholder:text-t8 focus:border-[var(--domain-journal)]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-6 font-mono text-[11px] text-t7">
        {words === 0 ? "No words yet" : `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete entry"
        description={`Delete your journal entry for ${formatLongDate(date)}? This can't be undone.`}
        onConfirm={handleDelete}
      />
    </article>
  );
}
