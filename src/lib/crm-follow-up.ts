import { todayISODate } from "@/lib/dates";
import type { CrmLead } from "@/types/database";

const FIRST_FOLLOW_UP_AFTER_DAYS = 3;
const SECOND_FOLLOW_UP_AFTER_DAYS = 7;

export const COLD_MAX_FOLLOW_UPS = 1;
export const WARM_MAX_FOLLOW_UPS = 2;

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export interface FollowUpLead {
  lead: CrmLead;
  /** Days since the lead entered its status (first follow-up) or since the last follow-up (second). */
  daysWaiting: number;
}

export interface FollowUpGroups {
  cold: FollowUpLead[];
  warm: FollowUpLead[];
}

/**
 * Cold ("Contacted"): due 3+ days after the lead entered that status, until 1 follow-up is
 * logged. Warm ("Mockup sent"): due 3+ days after entering that status, then again 7+ days after
 * the first follow-up, until 2 are logged. Once the cap is hit the lead drops out.
 */
export function getFollowUpGroups(leads: CrmLead[], today = todayISODate()): FollowUpGroups {
  const cold: FollowUpLead[] = [];
  const warm: FollowUpLead[] = [];

  for (const lead of leads) {
    const sinceStatusChange = daysBetween(lead.status_changed_at, today);

    if (lead.status === "Contacted" && lead.follow_up_count < COLD_MAX_FOLLOW_UPS) {
      if (sinceStatusChange >= FIRST_FOLLOW_UP_AFTER_DAYS) cold.push({ lead, daysWaiting: sinceStatusChange });
    } else if (lead.status === "Mockup sent" && lead.follow_up_count < WARM_MAX_FOLLOW_UPS) {
      if (lead.follow_up_count === 0) {
        if (sinceStatusChange >= FIRST_FOLLOW_UP_AFTER_DAYS) warm.push({ lead, daysWaiting: sinceStatusChange });
      } else if (lead.last_followed_up) {
        const sinceLast = daysBetween(lead.last_followed_up, today);
        if (sinceLast >= SECOND_FOLLOW_UP_AFTER_DAYS) warm.push({ lead, daysWaiting: sinceLast });
      }
    }
  }

  const byWaitingDesc = (a: FollowUpLead, b: FollowUpLead) => b.daysWaiting - a.daysWaiting;
  return { cold: cold.sort(byWaitingDesc), warm: warm.sort(byWaitingDesc) };
}
