import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataExport } from "@/components/settings/data-export";
import { DataImport } from "@/components/settings/data-import";
import { BackupInfo } from "@/components/settings/backup-info";

export default async function DataSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Data & Backup</h1>
        <p className="text-sm text-muted">You should always be able to take your data somewhere else.</p>
      </div>

      <DataExport />
      <DataImport />
      <BackupInfo />
    </div>
  );
}
