"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Plus, Handshake, Upload, Trash2 } from "lucide-react";
import clsx from "clsx";
import { CrmTable } from "@/components/crm/crm-table";
import { CrmKanban } from "@/components/crm/crm-kanban";
import { CrmLeadFormModal } from "@/components/crm/crm-lead-form-modal";
import { ImportLeadsModal } from "@/components/crm/import-leads-modal";
import { CrmFollowUp } from "@/components/crm/crm-follow-up";
import { fromCSV } from "@/lib/csv";
import { getFollowUpGroups } from "@/lib/crm-follow-up";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteCrmLead, deleteCrmLeads, markCrmLeadFollowedUp, setCrmLeadStatus } from "@/lib/actions/crm-leads";
import type { CrmLead, CrmLeadStatus } from "@/types/database";

const STATUSES: CrmLeadStatus[] = ["New", "Contacted", "Replied", "Mockup sent", "Won", "Lost"];

export function CrmBoard({ leads }: { leads: CrmLead[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view = viewParam === "table" || viewParam === "followup" ? viewParam : "kanban";
  const statusFilter = searchParams.get("status") ?? "all";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<CrmLead | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  async function handleImportFile(file: File) {
    const text = await file.text();
    setImportRows(fromCSV(text));
    setImportOpen(true);
  }

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function openNew() {
    setEditingLead(null);
    setModalOpen(true);
  }

  function openEdit(lead: CrmLead) {
    setEditingLead(lead);
    setModalOpen(true);
  }

  async function handleStatusChange(lead: CrmLead, status: CrmLeadStatus) {
    await setCrmLeadStatus(lead.id, status);
    router.refresh();
  }

  const tableLeads = statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter);
  const followUpGroups = getFollowUpGroups(leads);
  const followUpCount = followUpGroups.cold.length + followUpGroups.warm.length;
  const selectedLeadIds = leads.filter((l) => selectedIds.has(l.id)).map((l) => l.id);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = tableLeads.length > 0 && tableLeads.every((l) => prev.has(l.id));
      const next = new Set(prev);
      for (const l of tableLeads) {
        if (allSelected) next.delete(l.id);
        else next.add(l.id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: "var(--domain-crm)" }}
          >
            <Plus size={16} />
            Add Lead
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line3 px-3 py-2 text-sm font-semibold text-t3 hover:bg-surface2"
          >
            <Upload size={16} />
            Import Leads
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex rounded-[11px] border border-line3 p-[3px]">
          {(
            [
              { key: "kanban", label: "Kanban" },
              { key: "table", label: "Table" },
              { key: "followup", label: "Needs follow-up" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateParams({ view: tab.key === "kanban" ? null : tab.key })}
              className={clsx(
                "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold",
                view === tab.key ? "bg-a13 text-accent" : "text-t5 hover:text-t2"
              )}
            >
              {tab.label}
              {tab.key === "followup" && followUpCount > 0 && (
                <span className="ml-1.5 font-mono text-[11px]">{followUpCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {view !== "followup" && selectedLeadIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[11px] border border-line3 bg-surface px-3 py-2 text-[13px]">
          <span className="font-semibold">{selectedLeadIds.length} selected</span>
          <button
            type="button"
            onClick={() => setBulkDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-red hover:bg-r13"
          >
            <Trash2 size={14} />
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-t5 hover:text-t2"
          >
            Clear
          </button>
        </div>
      )}

      {view === "table" && (
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => updateParams({ status: e.target.value === "all" ? null : e.target.value })}
            className="rounded-[11px] border border-line3 bg-surface px-3 py-2 text-[13px] outline-none focus:border-[var(--domain-crm)]"
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No leads yet"
          description="Add a prospect to start tracking your outreach pipeline."
          action={
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Add Lead
            </button>
          }
        />
      ) : view === "followup" ? (
        <CrmFollowUp
          groups={followUpGroups}
          onMarkFollowedUp={async (id) => {
            await markCrmLeadFollowedUp(id);
            router.refresh();
          }}
        />
      ) : view === "kanban" ? (
        <CrmKanban
          leads={leads}
          onEdit={openEdit}
          onDelete={setDeletingLead}
          onStatusChange={handleStatusChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <CrmTable
          leads={tableLeads}
          onEdit={openEdit}
          onDelete={setDeletingLead}
          onStatusChange={handleStatusChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      <CrmLeadFormModal key={editingLead?.id ?? "new"} open={modalOpen} onClose={() => setModalOpen(false)} lead={editingLead} />

      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} rows={importRows} />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Delete selected leads"
        description={`Delete ${selectedLeadIds.length} selected ${selectedLeadIds.length === 1 ? "lead" : "leads"}? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteCrmLeads(selectedLeadIds);
          setSelectedIds(new Set());
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingLead)}
        onClose={() => setDeletingLead(null)}
        title="Delete lead"
        description={`Delete "${deletingLead?.name}"? This can't be undone.`}
        onConfirm={async () => {
          if (deletingLead) {
            await deleteCrmLead(deletingLead.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
