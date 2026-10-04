"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { CrmLead, CrmLeadStatus } from "@/types/database";

const COLUMNS: CrmLeadStatus[] = ["New", "Contacted", "Replied", "Mockup sent", "Won", "Lost"];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CrmKanban({
  leads,
  onEdit,
  onDelete,
  onStatusChange,
  selectedIds,
  onToggleSelect,
}: {
  leads: CrmLead[];
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (lead: CrmLead, status: CrmLeadStatus) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CrmLeadStatus | null>(null);

  function handleDrop(e: React.DragEvent, column: CrmLeadStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== column) onStatusChange(lead, column);
    setDraggingId(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const columnLeads = leads.filter((l) => l.status === column);
        return (
          <div
            key={column}
            className="w-64 shrink-0"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(column);
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === column ? null : c))}
            onDrop={(e) => handleDrop(e, column)}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-t5">{column}</h3>
              <span className="text-[11px] text-t6">{columnLeads.length}</span>
            </div>
            <div
              className={clsx(
                "flex min-h-[60px] flex-col gap-2 rounded-[12px] p-1",
                dragOverColumn === column && "bg-a05"
              )}
            >
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", lead.id);
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={clsx(
                    "cursor-grab rounded-[12px] border border-line bg-surface p-3 hover:border-[var(--domain-crm)]/50 active:cursor-grabbing",
                    draggingId === lead.id && "opacity-40",
                    selectedIds.has(lead.id) && "border-[var(--domain-crm)]"
                  )}
                >
                  <div className="mb-1.5 flex justify-end">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => onToggleSelect(lead.id)}
                      aria-label={`Select ${lead.name}`}
                      className="h-4 w-4 cursor-pointer accent-[var(--domain-crm)]"
                    />
                  </div>
                  <button type="button" onClick={() => onEdit(lead)} className="block w-full text-left">
                    <p className="text-[13px] font-medium">{lead.name}</p>
                    {lead.website_url && (
                      <p className="mt-1 truncate text-[11.5px] text-t5">{lead.website_url.replace(/^https?:\/\//, "")}</p>
                    )}
                    {lead.contact && <p className="mt-0.5 text-[11.5px] text-t5">{lead.contact}</p>}
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] text-t6">{formatDate(lead.date)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(lead)}
                        aria-label="Edit lead"
                        className="rounded-lg p-1 text-t5 hover:text-foreground"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lead)}
                        aria-label="Delete lead"
                        className="rounded-lg p-1 text-t5 hover:text-red"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && (
                <p className="rounded-[12px] border border-dashed border-line3 py-6 text-center text-[11.5px] text-t6">
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
