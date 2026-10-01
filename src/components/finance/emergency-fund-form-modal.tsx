"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, TextInput } from "@/components/ui/field";
import { createEmergencyFund, updateEmergencyFund } from "@/lib/actions/emergency-fund";

export interface EmergencyFundFormValues {
  id: string;
  name: string;
  targetAmount: number;
}

export function EmergencyFundFormModal({
  open,
  onClose,
  fund,
}: {
  open: boolean;
  onClose: () => void;
  fund?: EmergencyFundFormValues | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(fund);

  const [name, setName] = useState(fund?.name ?? "");
  const [target, setTarget] = useState(fund ? String(fund.targetAmount) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setName(fund?.name ?? "");
    setTarget(fund ? String(fund.targetAmount) : "");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const targetValue = Number(target);
    if (!target || targetValue <= 0) {
      setError("Enter a valid target amount");
      return;
    }

    setPending(true);
    try {
      if (isEditing && fund) {
        await updateEmergencyFund(fund.id, { name, targetAmount: targetValue });
      } else {
        await createEmergencyFund(name, targetValue);
      }
      router.refresh();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? "Edit fund" : "New emergency fund"} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="fund-name">
          <TextInput
            id="fund-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Motorcycle"
            autoFocus
            required
          />
        </Field>

        <Field label="Target amount (MAD)" htmlFor="fund-target">
          <TextInput
            id="fund-target"
            type="number"
            min={0.01}
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="5000"
            required
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#04212a] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--domain-savings)" }}
          >
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create fund"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
