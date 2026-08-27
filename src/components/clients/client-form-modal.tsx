"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createClientRecord, updateClientRecord } from "@/lib/actions/clients";
import type { Client, ClientStatus } from "@/types/database";

const STATUSES: ClientStatus[] = [
  "Lead",
  "Contacted",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
  "Client",
  "Inactive",
];

export function ClientFormModal({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(client);

  const [name, setName] = useState(client?.name ?? "");
  const [company, setCompany] = useState(client?.company ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [country, setCountry] = useState(client?.country ?? "");
  const [source, setSource] = useState(client?.source ?? "");
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "Client");
  const [notes, setNotes] = useState(client?.notes ?? "");
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
        email: email || null,
        phone: phone || null,
        country: country || null,
        source: source || null,
        status,
        notes: notes || null,
      };

      if (isEditing && client) {
        await updateClientRecord(client.id, payload);
        router.refresh();
        onClose();
      } else {
        const created = await createClientRecord(payload);
        router.refresh();
        onClose();
        if (created?.id) router.push(`/clients/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit client" : "New client"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="client-name">
            <TextInput id="client-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label="Company" htmlFor="client-company">
            <TextInput id="client-company" value={company ?? ""} onChange={(e) => setCompany(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="client-email">
            <TextInput id="client-email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="client-phone">
            <TextInput id="client-phone" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Country" htmlFor="client-country">
            <TextInput id="client-country" value={country ?? ""} onChange={(e) => setCountry(e.target.value)} />
          </Field>
          <Field label="Source" htmlFor="client-source">
            <TextInput
              id="client-source"
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Referral"
            />
          </Field>
          <Field label="Status" htmlFor="client-status">
            <Select id="client-status" value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="client-notes">
          <Textarea id="client-notes" rows={3} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
