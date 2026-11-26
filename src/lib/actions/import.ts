import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { MAX_BACKUP_BYTES } from "@/lib/workspace-backup";
import { backupOperationError, commitWorkspaceRestore } from "@/lib/restore-commit";

export async function restoreBackup(jsonText: string, mode: "preview" | "restore"): Promise<Response> {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: "Sign in to access backups." }, { status: 401 });
  if (session.restricted || session.profile?.status !== "approved") {
    return Response.json({ error: "An approved account is required." }, { status: 403 });
  }
  if (Buffer.byteLength(jsonText) > MAX_BACKUP_BYTES) {
    return Response.json({ error: "Backup files must be 3 MiB or smaller." }, { status: 413 });
  }

  // PostgreSQL parses the document so embedded JSON numbers stay exact.
  const { supabase } = session;
  const args = { document: jsonText };
  if (mode === "preview") {
    const { data, error } = await supabase.rpc("preview_workspace_restore_text", args);
    if (error) return backupOperationError(error);
    return Response.json({ preview: data });
  }

  return commitWorkspaceRestore(
    () => supabase.rpc("restore_workspace_backup_text", args),
    () => revalidatePath("/", "layout"),
    (error) => console.error("[backup] Cache invalidation failed after restore committed", error),
  );
}
