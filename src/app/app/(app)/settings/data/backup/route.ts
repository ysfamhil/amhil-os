import { getSessionProfile } from "@/lib/auth";
import { MAX_BACKUP_BYTES } from "@/lib/workspace-backup";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getSessionProfile();
  if (session?.profile?.status !== "approved" || session.restricted) {
    return Response.json({ error: "An approved account is required." }, { status: 403, headers: privateHeaders });
  }

  const { data, error } = await session.supabase.rpc("export_workspace_backup_text");
  if (error) {
    const invalid = error.code === "22023";
    return Response.json({ error: invalid ? error.message : "Could not export the workspace." },
      { status: invalid ? 422 : 500, headers: privateHeaders });
  }
  const { body, has_warnings } = data;
  const length = Buffer.byteLength(body);
  if (length > MAX_BACKUP_BYTES) {
    return Response.json({ error: "Backup exceeds the supported size limit (3 MiB)." },
      { status: 422, headers: privateHeaders });
  }
  return new Response(body, {
    headers: {
      ...privateHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(length),
      "Content-Disposition": 'attachment; filename="amhil-os-export.json"',
      "X-Content-Type-Options": "nosniff",
      ...(has_warnings && { "X-Workspace-Backup-Warnings": "1" }),
    },
  });
}
