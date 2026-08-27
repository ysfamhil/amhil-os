"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Select, TextInput, Textarea } from "@/components/ui/field";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { Expense } from "@/types/database";

export const EXPENSE_CATEGORIES = [
  "Software",
  "Hardware",
  "Marketing",
  "Transportation",
  "Workspace",
  "Education",
  "Services",
  "Personal",
  "Other",
];

export interface ProjectOption {
  id: string;
  name: string;
}

export function ExpenseFormModal({
  open,
  onClose,
  expense,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(expense);

  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(expense?.category ?? "Other");
  const [projectId, setProjectId] = useState(expense?.project_id ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
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
        category: category || null,
        project_id: projectId || null,
        description: description || null,
      };
      if (isEditing && expense) {
        await updateExpense(expense.id, payload);
      } else {
        await createExpense(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit expense" : "New expense"} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (MAD)" htmlFor="expense-amount">
            <TextInput
              id="expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Date" htmlFor="expense-date">
            <TextInput id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="expense-category">
            <Select id="expense-category" value={category ?? ""} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project" htmlFor="expense-project">
            <Select id="expense-project" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="expense-description">
          <Textarea
            id="expense-description"
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
