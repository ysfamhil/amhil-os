"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { searchAll, type SearchResultGroup } from "@/lib/actions/search";

export function SearchPageClient() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    debounceRef.current = setTimeout(
      async () => {
        if (trimmed.length < 2) {
          setGroups([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          setGroups(await searchAll(query));
        } finally {
          setLoading(false);
        }
      },
      trimmed.length < 2 ? 0 : 250
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasResults = groups.some((g) => g.results.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 focus-within:border-accent">
        <SearchIcon size={18} className="shrink-0 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, projects, goals, clients, notes…"
          autoFocus
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {loading && <Loader2 size={16} className="shrink-0 animate-spin text-muted" />}
      </div>

      {query.trim().length < 2 ? (
        <EmptyState icon={SearchIcon} title="Search everything" description="Type at least 2 characters to search across your whole workspace." />
      ) : !loading && !hasResults ? (
        <EmptyState icon={SearchIcon} title="No results" description={`Nothing matched "${query}".`} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.category}</h3>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                {group.results.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-border/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      {item.subtitle && <p className="truncate text-xs text-muted">{item.subtitle}</p>}
                    </div>
                    {item.meta && <span className="shrink-0 text-xs text-muted">{item.meta}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
