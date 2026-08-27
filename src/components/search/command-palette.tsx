"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles } from "lucide-react";
import { searchAll, type SearchResultGroup, type SearchResultItem } from "@/lib/actions/search";

function flattenResults(groups: SearchResultGroup[]): { group: string; item: SearchResultItem }[] {
  return groups.flatMap((g) => g.results.map((item) => ({ group: g.category, item })));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    function resetAndOpen() {
      setQuery("");
      setGroups([]);
      setActiveIndex(0);
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    function handleGlobalKeydown(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isModK) return;
      e.preventDefault();
      if (openRef.current) {
        setOpen(false);
      } else {
        resetAndOpen();
      }
    }
    document.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("open-command-palette", resetAndOpen);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeydown);
      window.removeEventListener("open-command-palette", resetAndOpen);
    };
  }, []);

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
          const results = await searchAll(query);
          setGroups(results);
          setActiveIndex(0);
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

  const flat = flattenResults(groups);
  const showAskAI = query.trim().length >= 2;
  const totalCount = flat.length + (showAskAI ? 1 : 0);

  function navigateTo(item: SearchResultItem) {
    setOpen(false);
    router.push(item.href);
  }

  function askAI() {
    setOpen(false);
    router.push(`/ai?q=${encodeURIComponent(query.trim())}`);
  }

  function activateIndex(index: number) {
    if (index === flat.length && showAskAI) {
      askAI();
    } else if (flat[index]) {
      navigateTo(flat[index].item);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalCount - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      activateIndex(activeIndex);
    }
  }

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, clients, notes…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {loading && <Loader2 size={16} className="shrink-0 animate-spin text-muted" />}
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Type at least 2 characters to search.</p>
          ) : !loading && flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No results for &quot;{query}&quot;.</p>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="mb-2 last:mb-0">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.category}</p>
                {group.results.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      onClick={() => navigateTo(item)}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm ${
                        isActive ? "bg-accent/15 text-accent" : "hover:bg-border/40"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        {item.meta && <span className="shrink-0 text-xs text-muted">{item.meta}</span>}
                      </span>
                      {item.subtitle && <span className="truncate text-xs text-muted">{item.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {showAskAI && (
            <div className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(flat.length)}
                onClick={askAI}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  activeIndex === flat.length ? "bg-accent/15 text-accent" : "hover:bg-border/40"
                }`}
              >
                <Sparkles size={14} className="shrink-0" />
                <span>
                  Ask AI: <span className="font-medium">&quot;{query}&quot;</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
