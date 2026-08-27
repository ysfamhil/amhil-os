import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      description="That record doesn't exist, or isn't yours."
      action={
        <Link
          href="/dashboard"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Back to dashboard
        </Link>
      }
    />
  );
}
