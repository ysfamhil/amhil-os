"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Plus, Handshake, Upload } from "lucide-react";
import clsx from "clsx";
import { CrmTable } from "@/components/crm/crm-table";
import { CrmKanban } from "@/components/crm/crm-kanban";
import { CrmLeadFormModal } from "@/components/crm/crm-lead-form-modal";
import { ImportLeadsModal } from "@/components/crm/import-leads-modal";
import { fromCSV } from "@/lib/csv";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteCrmLead, setCrmLeadStatus } from "@/lib/actions/crm-leads";
import type { CrmLead, CrmLeadStatus } from "@/types/database";

const STATUSES: CrmLeadStatus[] = ["New", "Contacted", "Replied", "Mockup sent", "Won", "Lost"];

export function CrmBoard({ leads }: { leads: CrmLead[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "kanban" ? "kanban" : "table";
  const statusFilter = searchParams.get("status") ?? "all";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<CrmLead | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importOpen, setImportOpen] = useState(false);

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
          <button
            type="button"
            onClick={() => updateParams({ view: "table" })}
            className={clsx(
              "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold",
              view === "table" ? "bg-a13 text-accent" : "text-t5 hover:text-t2"
            )}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => updateParams({ view: "kanban" })}
            className={clsx(
              "rounded-[8px] px-3 py-1.5 text-[13px] font-semibold",
              view === "kanban" ? "bg-a13 text-accent" : "text-t5 hover:text-t2"
            )}
          >
            Kanban
          </button>
        </div>
      </div>

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
      ) : view === "kanban" ? (
        <CrmKanban leads={leads} onEdit={openEdit} onDelete={setDeletingLead} onStatusChange={handleStatusChange} />
      ) : (
        <CrmTable leads={tableLeads} onEdit={openEdit} onDelete={setDeletingLead} onStatusChange={handleStatusChange} />
      )}

      <CrmLeadFormModal key={editingLead?.id ?? "new"} open={modalOpen} onClose={() => setModalOpen(false)} lead={editingLead} />

      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} rows={importRows} />

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
