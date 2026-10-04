"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { COLD_MAX_FOLLOW_UPS, WARM_MAX_FOLLOW_UPS, type FollowUpGroups, type FollowUpLead } from "@/lib/crm-follow-up";

function Group({
  title,
  subtitle,
  items,
  maxFollowUps,
  pendingId,
  onMarkFollowedUp,
}: {
  title: string;
  subtitle: string;
  items: FollowUpLead[];
  maxFollowUps: number;
  pendingId: string | null;
  onMarkFollowedUp: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h3 className="text-[13px] font-bold">
          {title} <span className="font-mono text-[11px] font-normal text-t6">{items.length}</span>
        </h3>
        <p className="text-[11.5px] text-t5">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line3 py-6 text-center text-[12px] text-t6">
          Nothing to follow up
        </p>
      ) : (
        items.map(({ lead, daysWaiting }) => (
          <div key={lead.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{lead.name}</p>
              <p className="truncate text-[11.5px] text-t5">
                {[lead.website_url?.replace(/^https?:\/\//, ""), lead.contact].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-t6">
                {daysWaiting} days waiting · follow-up {lead.follow_up_count + 1} of {maxFollowUps}
              </p>
            </div>
            <button
              type="button"
              disabled={pendingId === lead.id}
              onClick={() => onMarkFollowedUp(lead.id)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--domain-crm)" }}
            >
              Mark followed up
            </button>
          </div>
        ))
      )}
    </section>
  );
}

export function CrmFollowUp({
  groups,
  onMarkFollowedUp,
}: {
  groups: FollowUpGroups;
  onMarkFollowedUp: (id: string) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(id: string) {
    setPendingId(id);
    setError(null);
    try {
      await onMarkFollowedUp(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPendingId(null);
    }
  }

  if (groups.cold.length === 0 && groups.warm.length === 0) {
    return (
      <EmptyState
        icon={BellRing}
        title="Nothing needs a follow-up"
        description="Contacted and Mockup sent leads show up here 3 days after entering that status; Mockup sent leads again a week after the first follow-up."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Group
          title="Cold — follow up once"
          subtitle="Contacted · 3+ days since it entered this status"
          items={groups.cold}
          maxFollowUps={COLD_MAX_FOLLOW_UPS}
          pendingId={pendingId}
          onMarkFollowedUp={handle}
        />
        <Group
          title="Warm — follow up twice"
          subtitle="Mockup sent · 3+ days in status, then 7+ days after the first follow-up"
          items={groups.warm}
          maxFollowUps={WARM_MAX_FOLLOW_UPS}
          pendingId={pendingId}
          onMarkFollowedUp={handle}
        />
      </div>
    </div>
  );
}
