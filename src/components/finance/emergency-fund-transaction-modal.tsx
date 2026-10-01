"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/modal";
import { Field, TextInput } from "@/components/ui/field";
import { addEmergencyFundDeposit, addEmergencyFundWithdrawal } from "@/lib/actions/emergency-fund";

type Mode = "deposit" | "withdraw";

export function EmergencyFundTransactionModal({
  open,
  onClose,
  fundId,
}: {
  open: boolean;
  onClose: () => void;
  fundId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setMode("deposit");
    setAmount("");
    setNote("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountValue = Number(amount);
    if (!amount || amountValue <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setPending(true);
    try {
      if (mode === "deposit") {
        await addEmergencyFundDeposit(fundId, amountValue, note || null);
      } else {
        await addEmergencyFundWithdrawal(fundId, amountValue, note || null);
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
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Emergency fund"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex rounded-lg border border-border p-[3px]">
          <button
            type="button"
            onClick={() => setMode("deposit")}
            className={clsx(
              "flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors",
              mode === "deposit" ? "bg-[var(--domain-savings)] text-[#04212a]" : "text-muted hover:text-foreground"
            )}
          >
            Add money
          </button>
          <button
            type="button"
            onClick={() => setMode("withdraw")}
            className={clsx(
              "flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors",
              mode === "withdraw" ? "bg-red text-white" : "text-muted hover:text-foreground"
            )}
          >
            Withdraw
          </button>
        </div>

        {mode === "withdraw" && (
          <div className="flex items-start gap-2 rounded-lg border border-red/30 bg-r13 px-3 py-2 text-[12.5px] text-red">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>This fund is for genuine emergencies only. Make sure this really is one before withdrawing.</span>
          </div>
        )}

        <Field label="Amount (MAD)" htmlFor="fund-amount">
          <TextInput
            id="fund-amount"
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
        </Field>

        <Field label="Note (optional)" htmlFor="fund-note">
          <TextInput
            id="fund-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "deposit" ? "e.g. Monthly top-up" : "e.g. Car repair"}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50",
              mode === "deposit" ? "text-[#04212a]" : "text-white"
            )}
            style={{ backgroundColor: mode === "deposit" ? "var(--domain-savings)" : "var(--red)" }}
          >
            {pending ? "Saving…" : mode === "deposit" ? "Add money" : "Withdraw"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
