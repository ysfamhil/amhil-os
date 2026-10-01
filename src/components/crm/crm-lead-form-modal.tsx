"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createCrmLead, updateCrmLead } from "@/lib/actions/crm-leads";
import { todayISODate } from "@/lib/dates";
import type { CrmLead, CrmLeadStatus } from "@/types/database";

const STATUSES: CrmLeadStatus[] = ["New", "Contacted", "Replied", "Mockup sent", "Won", "Lost"];

export function CrmLeadFormModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead?: CrmLead | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(lead);

  const [name, setName] = useState(lead?.name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(lead?.website_url ?? "");
  const [contact, setContact] = useState(lead?.contact ?? "");
  const [status, setStatus] = useState<CrmLeadStatus>(lead?.status ?? "New");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [date, setDate] = useState(lead?.date ?? todayISODate());
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
        website_url: websiteUrl || null,
        contact: contact || null,
        status,
        notes: notes || null,
        date,
      };

      if (isEditing && lead) {
        await updateCrmLead(lead.id, payload);
      } else {
        await createCrmLead(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit lead" : "New lead"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="lead-name">
          <TextInput id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </Field>

        <Field label="Website URL" htmlFor="lead-website">
          <TextInput
            id="lead-website"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </Field>

        <Field label="Contact" htmlFor="lead-contact">
          <TextInput
            id="lead-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="X username or email"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="lead-status">
            <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as CrmLeadStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="lead-date">
            <TextInput id="lead-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
