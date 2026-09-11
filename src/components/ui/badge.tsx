import clsx from "clsx";
import type { ReactNode } from "react";

const TONE_CLASSES = {
  neutral: "bg-chip text-t4",
  accent: "bg-a13 text-accent",
  success: "bg-g12 text-green",
  warning: "bg-am13 text-amber",
  danger: "bg-r13 text-red",
  info: "bg-b13 text-blue",
  tasks: "bg-[color-mix(in_srgb,var(--domain-tasks)_16%,transparent)] text-[var(--domain-tasks)]",
  habits: "bg-[color-mix(in_srgb,var(--domain-habits)_16%,transparent)] text-[var(--domain-habits)]",
  goals: "bg-[color-mix(in_srgb,var(--domain-goals)_16%,transparent)] text-[var(--domain-goals)]",
  time: "bg-[color-mix(in_srgb,var(--domain-time)_16%,transparent)] text-[var(--domain-time)]",
  finance: "bg-[color-mix(in_srgb,var(--domain-finance)_16%,transparent)] text-[var(--domain-finance)]",
  learning: "bg-[color-mix(in_srgb,var(--domain-learning)_16%,transparent)] text-[var(--domain-learning)]",
  notes: "bg-[color-mix(in_srgb,var(--domain-notes)_16%,transparent)] text-[var(--domain-notes)]",
  savings: "bg-[color-mix(in_srgb,var(--domain-savings)_16%,transparent)] text-[var(--domain-savings)]",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-[2px] text-[10.5px] font-semibold",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}

export function priorityTone(priority: string): keyof typeof TONE_CLASSES {
  if (priority === "Urgent") return "danger";
  if (priority === "High") return "warning";
  if (priority === "Medium") return "accent";
  return "neutral";
}
