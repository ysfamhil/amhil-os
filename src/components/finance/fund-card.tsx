import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { EmergencyFundListItem } from "@/lib/queries/emergency-fund";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function FundCard({ fund }: { fund: EmergencyFundListItem }) {
  const progress = fund.targetAmount > 0 ? Math.min(100, (fund.balance / fund.targetAmount) * 100) : 0;

  return (
    <Link href={`/finance/funds/${fund.id}`}>
      <Card className="flex h-full flex-col gap-3 transition-colors hover:border-accent/50">
        <h3 className="font-medium">{fund.name}</h3>

        <p className="text-lg font-semibold">
          {money(fund.balance)} <span className="text-sm font-normal text-muted">/ {money(fund.targetAmount)} MAD</span>
        </p>

        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{Math.round(progress)}% funded</span>
          </div>
          <ProgressBar value={progress} color="var(--domain-savings)" />
        </div>
      </Card>
    </Link>
  );
}
