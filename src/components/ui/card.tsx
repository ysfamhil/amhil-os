import clsx from "clsx";
import type { ReactNode } from "react";

const DOMAIN_COLORS = {
  tasks: "var(--domain-tasks)",
  habits: "var(--domain-habits)",
  goals: "var(--domain-goals)",
  time: "var(--domain-time)",
  finance: "var(--domain-finance)",
  learning: "var(--domain-learning)",
  notes: "var(--domain-notes)",
  savings: "var(--domain-savings)",
  danger: "var(--domain-danger)",
} as const;

export type Domain = keyof typeof DOMAIN_COLORS;
export { DOMAIN_COLORS };

export function Card({
  children,
  className,
  domain,
}: {
  children: ReactNode;
  className?: string;
  domain?: Domain;
}) {
  return (
    <div
      className={clsx("relative overflow-hidden rounded-[18px] border border-line bg-surface p-[18px] shadow-card", className)}
      style={domain ? { boxShadow: `inset 0 3px 0 0 ${DOMAIN_COLORS[domain]}` } : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}
