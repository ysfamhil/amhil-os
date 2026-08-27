import clsx from "clsx";
import type { ReactNode } from "react";

const TONE_CLASSES = {
  neutral: "bg-border/50 text-foreground",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
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
