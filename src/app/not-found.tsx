import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <EmptyState
          icon={SearchX}
          title="Not found"
          description="That page doesn't exist."
          action={
            <Link
              href="/dashboard"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Back to dashboard
            </Link>
          }
        />
      </div>
    </div>
  );
}
