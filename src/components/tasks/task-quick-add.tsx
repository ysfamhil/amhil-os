"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createTask } from "@/lib/actions/tasks";
import { parseQuickAdd } from "@/lib/parse-quick-add";
import { tagColor } from "@/lib/tag-color";
import { priorityTone } from "@/components/ui/badge";

export function TaskQuickAdd() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const parsed = value.trim() ? parseQuickAdd(value) : null;

  async function submit() {
    const text = value.trim();
    if (!text || pending) return;
    const result = parseQuickAdd(text);
    if (!result.title) return;

    setPending(true);
    try {
      await createTask({
        title: result.title,
        priority: result.priority ?? "Medium",
        due_date: result.dueDate ?? null,
        category: result.tag ?? null,
      });
      setValue("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setValue("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-dashed border-line3 px-[13px] py-[10px] focus-within:border-[var(--domain-tasks)]">
      <span className="h-5 w-5 shrink-0 rounded-[7px] border border-dashed border-line4" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task… try “tomorrow !high #Odoo”"
        disabled={pending}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-t7"
      />
      {parsed && (
        <div className="flex shrink-0 items-center gap-1.5">
          {parsed.dueDateLabel && (
            <span className="rounded-full bg-b13 px-[7px] py-[2px] text-[10.5px] font-semibold text-blue">
              {parsed.dueDateLabel}
            </span>
          )}
          {parsed.priority && (
            <span
              className={clsx(
                "rounded-full px-[7px] py-[2px] text-[10.5px] font-semibold",
                priorityTone(parsed.priority) === "danger" && "bg-r13 text-red",
                priorityTone(parsed.priority) === "warning" && "bg-am13 text-amber",
                priorityTone(parsed.priority) === "accent" && "bg-a13 text-accent",
                priorityTone(parsed.priority) === "neutral" && "bg-chip text-t4"
              )}
            >
              {parsed.priority}
            </span>
          )}
          {parsed.tag && (
            <span
              className="rounded-full px-[7px] py-[2px] text-[10.5px] font-semibold"
              style={{ backgroundColor: `color-mix(in srgb, ${tagColor(parsed.tag)} 16%, transparent)`, color: tagColor(parsed.tag) }}
            >
              #{parsed.tag}
            </span>
          )}
        </div>
      )}
      {value.trim() && (
        <kbd className="hidden shrink-0 rounded border border-line4 px-[5px] py-[1px] font-mono text-[10px] text-t6 sm:inline">
          ↵
        </kbd>
      )}
    </div>
  );
}
