"use client";

import { ArrowRightCircle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Lead, LeadStatus } from "@/types/database";

const COLUMNS: LeadStatus[] = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function LeadsKanban({
  leads,
  onEdit,
  onDelete,
  onStatusChange,
  onConvert,
}: {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
  onConvert: (lead: Lead) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const columnLeads = leads.filter((l) => l.status === column);
        return (
          <div key={column} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{column}</h3>
              <span className="text-xs text-muted">{columnLeads.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnLeads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border bg-surface p-3 hover:border-accent/50">
                  <button type="button" onClick={() => onEdit(lead)} className="block w-full text-left">
                    <p className="text-sm font-medium">{lead.name}</p>
                    {lead.company && <p className="text-xs text-muted">{lead.company}</p>}
                    {lead.estimated_value != null && (
                      <p className="mt-1 text-xs text-accent">{money(lead.estimated_value)} MAD</p>
                    )}
                    {lead.source && <p className="mt-1 text-xs text-muted">via {lead.source}</p>}
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) => onStatusChange(lead, e.target.value as LeadStatus)}
                      className="rounded-md border border-border bg-background px-1 py-0.5 text-xs outline-none focus:border-accent"
                    >
                      {COLUMNS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      {lead.status === "Won" && !lead.converted_client_id && (
                        <button
                          type="button"
                          onClick={() => onConvert(lead)}
                          aria-label="Convert to client"
                          className="text-accent hover:opacity-80"
                        >
                          <ArrowRightCircle size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(lead)}
                        aria-label="Edit lead"
                        className="text-muted hover:text-foreground"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lead)}
                        aria-label="Delete lead"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {lead.status === "Won" && lead.converted_client_id && (
                    <Badge tone="success">Converted</Badge>
                  )}
                </div>
              ))}
              {columnLeads.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted">
                  No leads
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
