"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, TextInput, Textarea } from "@/components/ui/field";
import { createArea, updateArea } from "@/lib/actions/learning";
import type { LearningArea } from "@/types/database";

export function AreaFormModal({
  open,
  onClose,
  area,
}: {
  open: boolean;
  onClose: () => void;
  area?: LearningArea | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(area);

  const [name, setName] = useState(area?.name ?? "");
  const [description, setDescription] = useState(area?.description ?? "");
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
      const payload = { name, description: description || null };
      if (isEditing && area) {
        await updateArea(area.id, payload);
      } else {
        await createArea(payload);
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
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit area" : "New learning area"} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="area-name">
          <TextInput id="area-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required placeholder="e.g. Odoo" />
        </Field>
        <Field label="Description" htmlFor="area-description">
          <Textarea
            id="area-description"
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
            {pending ? "Saving…" : isEditing ? "Save changes" : "Create area"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
