"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import clsx from "clsx";

const TOOLBAR_ACTIONS = [
  { command: "bold", label: "Bold", icon: Bold },
  { command: "italic", label: "Italic", icon: Italic },
  { command: "underline", label: "Underline", icon: Underline },
  { command: "insertUnorderedList", label: "Bullet list", icon: List },
  { command: "insertOrderedList", label: "Numbered list", icon: ListOrdered },
] as const;

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const [isEmpty, setIsEmpty] = useState(!value);

  useEffect(() => {
    if (editorRef.current && isFirstRender.current) {
      // An empty or block-less contentEditable confuses execCommand's block
      // resolution (e.g. insertUnorderedList can grab the wrong "current
      // block" and reorder content). Always seed a real block element so
      // every line is a proper <div>, matching what typing+Enter produces.
      editorRef.current.innerHTML = value || "<div><br></div>";
      isFirstRender.current = false;
    }
  }, [value]);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    onChange(e.currentTarget.innerHTML);
    setIsEmpty(e.currentTarget.textContent === "");
  }

  function runCommand(command: string) {
    document.execCommand("defaultParagraphSeparator", false, "div");
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background focus-within:border-accent">
      <div className="flex items-center gap-0.5 border-b border-border p-1">
        {TOOLBAR_ACTIONS.map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            onMouseDown={(e) => {
              e.preventDefault();
              runCommand(command);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-border/40 hover:text-foreground"
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted">{placeholder}</span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className={clsx(
            "min-h-[140px] px-3 py-2 text-sm outline-none",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          )}
        />
      </div>
    </div>
  );
}
