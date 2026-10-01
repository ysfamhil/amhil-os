"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { CrmLead, CrmLeadStatus } from "@/types/database";

const STATUSES: CrmLeadStatus[] = ["New", "Contacted", "Replied", "Mockup sent", "Won", "Lost"];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CrmTable({
  leads,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  leads: CrmLead[];
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (lead: CrmLead, status: CrmLeadStatus) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.07em] text-t5">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Website</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-line2 last:border-b-0 hover:bg-surface2">
                <td className="px-4 py-3 font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-t4">
                  {lead.website_url ? (
                    <a
                      href={lead.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {lead.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-t4">{lead.contact || "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={(e) => onStatusChange(lead, e.target.value as CrmLeadStatus)}
                    className="rounded-lg border border-line3 bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-[var(--domain-crm)]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-t6">{formatDate(lead.date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(lead)}
                      aria-label="Edit lead"
                      className="rounded-lg p-1.5 text-t5 hover:bg-surface2 hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(lead)}
                      aria-label="Delete lead"
                      className="rounded-lg p-1.5 text-t5 hover:text-red"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
