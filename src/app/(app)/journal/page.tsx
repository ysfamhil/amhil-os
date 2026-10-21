import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJournalDates, getJournalEntry, getJournalList } from "@/lib/queries/journal";
import { JournalBoard } from "@/components/journal/journal-board";
import { todayISODate } from "@/lib/dates";
import { isJournalMood, isValidISODate } from "@/lib/journal";

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const serverToday = todayISODate();
  const dateParam = param(sp.date);
  const explicitDate = isValidISODate(dateParam);
  const selectedDate = explicitDate ? dateParam : serverToday;

  const q = param(sp.q);
  const moodParam = param(sp.mood);
  const mood = isJournalMood(moodParam) ? moodParam : undefined;
  const from = isValidISODate(param(sp.from)) ? param(sp.from) : undefined;
  const to = isValidISODate(param(sp.to)) ? param(sp.to) : undefined;

  const [entry, items, entryDates] = await Promise.all([
    getJournalEntry(supabase, user.id, selectedDate),
    getJournalList(supabase, user.id, { q, mood, from, to }),
    getJournalDates(supabase, user.id),
  ]);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-[28px] w-[5px] shrink-0 rounded-full bg-[var(--domain-journal)]" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">Journal</h1>
          <p className="mt-1.5 text-[13px] text-muted">A private place to record your days and what you learn from them.</p>
        </div>
      </div>

      <JournalBoard
        selectedDate={selectedDate}
        serverToday={serverToday}
        explicitDate={explicitDate}
        entry={entry}
        items={items}
        entryDates={entryDates}
        filters={{ q: q ?? "", mood: mood ?? "", from: from ?? "", to: to ?? "" }}
      />
    </div>
  );
}
