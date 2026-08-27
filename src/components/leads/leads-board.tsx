"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Target, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { LeadFormModal } from "@/components/leads/lead-form-modal";
import { convertLeadToClient, deleteLead, setLeadStatus } from "@/lib/actions/leads";
import type { LeadAnalytics } from "@/lib/queries/leads";
import type { Lead, LeadStatus } from "@/types/database";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function LeadsBoard({ leads, analytics }: { leads: Lead[]; analytics: LeadAnalytics }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(null);

  function openNew() {
    setEditingLead(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total leads</p>
          <p className="mt-1 text-lg font-semibold">{analytics.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Conversion rate</p>
          <p className="mt-1 text-lg font-semibold">{analytics.conversionRate}%</p>
          <p className="text-xs text-muted">won ÷ total</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Pipeline value</p>
          <p className="mt-1 text-lg font-semibold">{money(analytics.pipelineValue)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Won value</p>
          <p className="mt-1 text-lg font-semibold text-success">{money(analytics.wonValue)} MAD</p>
        </Card>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Lead
        </button>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="Track prospects through your pipeline from first contact to won."
          action={
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Lead
            </button>
          }
        />
      ) : (
        <LeadsKanban
          leads={leads}
          onEdit={(lead) => {
            setEditingLead(lead);
            setModalOpen(true);
          }}
          onDelete={setDeletingLead}
          onStatusChange={async (lead, status) => {
            await setLeadStatus(lead.id, status as LeadStatus);
            router.refresh();
          }}
          onConvert={setConvertingLead}
        />
      )}

      <LeadFormModal key={editingLead?.id ?? "new"} open={modalOpen} onClose={() => setModalOpen(false)} lead={editingLead} />

      <ConfirmDialog
        open={Boolean(deletingLead)}
        onClose={() => setDeletingLead(null)}
        title="Delete lead"
        description={`Delete "${deletingLead?.name}"? This can't be undone.`}
        onConfirm={async () => {
          if (deletingLead) {
            await deleteLead(deletingLead.id);
            router.refresh();
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(convertingLead)}
        onClose={() => {
          setConvertingLead(null);
          setConvertedClientId(null);
        }}
        title="Convert to client"
        confirmLabel="Convert"
        description={`Create a client from "${convertingLead?.name}"? Their name, company, contact, source, and notes will carry over.`}
        onConfirm={async () => {
          if (convertingLead) {
            const result = await convertLeadToClient(convertingLead.id);
            setConvertedClientId(result.clientId);
            router.refresh();
          }
        }}
      />

      {convertedClientId && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-surface p-4 shadow-xl">
          <p className="text-sm">Client created.</p>
          <Link
            href={`/clients/${convertedClientId}`}
            className="text-sm font-medium text-accent hover:underline"
            onClick={() => setConvertedClientId(null)}
          >
            View client →
          </Link>
        </div>
      )}
    </div>
  );
}
