import { ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

export function BackupInfo() {
  return (
    <Card>
      <CardHeader title="Backup strategy" />
      <div className="flex flex-col gap-3 text-sm text-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <strong className="text-foreground">Supabase (infrastructure level):</strong> don&apos;t assume there is a
            backup to restore. Automatic daily backups are a paid-plan feature and are not guaranteed on the Free plan;
            Point-in-Time Recovery is a paid add-on. Check Database → Backups in the Supabase dashboard to see what your
            project actually has.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <strong className="text-foreground">Application level (this page):</strong> the JSON export above is a
            versioned copy of your workspace records and relationships. Keep it private because it can include journal,
            client, and financial data. Restore it into an empty workspace. CSV exports are for spreadsheets.
          </span>
        </p>
        <p>
          Recommended: export the full JSON backup periodically and keep a copy somewhere outside Supabase entirely —
          that&apos;s what guarantees you can always take your data somewhere else, independent of any one provider.
        </p>
      </div>
    </Card>
  );
}
