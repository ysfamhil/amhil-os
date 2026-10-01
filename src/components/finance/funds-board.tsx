"use client";

import { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { FundCard } from "@/components/finance/fund-card";
import { EmergencyFundFormModal } from "@/components/finance/emergency-fund-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { EmergencyFundListItem } from "@/lib/queries/emergency-fund";

export function FundsBoard({ funds }: { funds: EmergencyFundListItem[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#04212a] hover:opacity-90"
          style={{ backgroundColor: "var(--domain-savings)" }}
        >
          <Plus size={16} />
          New Fund
        </button>
      </div>

      {funds.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No emergency funds yet"
          description="Create a fund with a target amount to start tracking your savings."
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#04212a] hover:opacity-90"
              style={{ backgroundColor: "var(--domain-savings)" }}
            >
              New Fund
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => (
            <FundCard key={fund.id} fund={fund} />
          ))}
        </div>
      )}

      <EmergencyFundFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
