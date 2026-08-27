"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createLead, updateLead } from "@/lib/actions/leads";
import type { Lead, LeadStatus } from "@/types/database";

const STATUSES: LeadStatus[] = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];

export function LeadFormModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(lead);

  const [name, setName] = useState(lead?.name ?? "");
  const [company, setCompany] = useState(lead?.company ?? "");
  const [contact, setContact] = useState(lead?.contact ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "Lead");
  const [estimatedValue, setEstimatedValue] = useState(
    lead?.estimated_value != null ? String(lead.estimated_value) : ""
  );
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setPending(true);
    try {
      const payload = {
        name,
        company: company || null,
        contact: contact || null,
        source: source || null,
        status,
        estimated_value: estimatedValue ? Number(estimatedValue) : null,
        notes: notes || null,
      };
      if (isEditing && lead) {
        await updateLead(lead.id, payload);
      } else {
        await createLead(payload);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit lead" : "New lead"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="lead-name">
            <TextInput id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label="Company" htmlFor="lead-company">
            <TextInput id="lead-company" value={company ?? ""} onChange={(e) => setCompany(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact (email or phone)" htmlFor="lead-contact">
            <TextInput id="lead-contact" value={contact ?? ""} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Source" htmlFor="lead-source">
            <TextInput
              id="lead-source"
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. LinkedIn"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="lead-status">
            <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated value (MAD)" htmlFor="lead-value">
            <TextInput
              id="lead-value"
              type="number"
              min={0}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="lead-notes">
          <Textarea id="lead-notes" rows={3} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
