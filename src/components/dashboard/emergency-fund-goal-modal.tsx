"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, TextInput } from "@/components/ui/field";
import { setEmergencyFundTarget } from "@/lib/actions/emergency-fund";

export function EmergencyFundGoalModal({
  open,
  onClose,
  currentTarget,
}: {
  open: boolean;
  onClose: () => void;
  currentTarget: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(String(currentTarget));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const targetValue = Number(target);
    if (!target || targetValue <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setPending(true);
    try {
      await setEmergencyFundTarget(targetValue);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit fund goal" size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Target amount (MAD)" htmlFor="fund-target">
          <TextInput
            id="fund-target"
            type="number"
            min={0.01}
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            autoFocus
            required
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
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#04212a] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--domain-savings)" }}
          >
            {pending ? "Saving…" : "Save goal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
