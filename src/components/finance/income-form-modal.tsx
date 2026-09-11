"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createIncome, updateIncome } from "@/lib/actions/income";
import { INCOME_TAGS } from "@/lib/tags";
import type { Income, IncomeStatus } from "@/types/database";

const STATUSES: IncomeStatus[] = ["Expected", "Invoiced", "Paid", "Cancelled"];

export function IncomeFormModal({
  open,
  onClose,
  income,
}: {
  open: boolean;
  onClose: () => void;
  income?: Income | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(income);

  const [amount, setAmount] = useState(income?.amount != null ? String(income.amount) : "");
  const [date, setDate] = useState(income?.date ?? new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState(income?.source ?? "");
  const [status, setStatus] = useState<IncomeStatus>(income?.status ?? "Expected");
  const [paymentDate, setPaymentDate] = useState(income?.payment_date ?? "");
  const [description, setDescription] = useState(income?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountValue = Number(amount);
    if (!amount || amountValue < 0) {
      setError("Enter a valid amount");
      return;
    }

    setPending(true);
    try {
      const payload = {
        amount: amountValue,
        date,
        source: source || null,
        status,
        payment_date: paymentDate || null,
        description: description || null,
      };
      if (isEditing && income) {
        await updateIncome(income.id, payload);
      } else {
        await createIncome(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit income" : "New income"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (MAD)" htmlFor="income-amount">
            <TextInput
              id="income-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Date" htmlFor="income-date">
            <TextInput id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tag" htmlFor="income-source">
            <TextInput
              id="income-source"
              list="income-tag-suggestions"
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Freelance"
            />
            <datalist id="income-tag-suggestions">
              {INCOME_TAGS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" htmlFor="income-status">
            <Select id="income-status" value={status} onChange={(e) => setStatus(e.target.value as IncomeStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {status === "Paid" && (
          <Field label="Payment date" htmlFor="income-payment-date">
            <TextInput
              id="income-payment-date"
              type="date"
              value={paymentDate ?? ""}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </Field>
        )}

        <Field label="Description" htmlFor="income-description">
          <Textarea
            id="income-description"
            rows={2}
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Add income"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
