import { restoreBackup } from "@/lib/actions/import";
import { MAX_BACKUP_BYTES } from "@/lib/workspace-backup";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (mode !== "preview" && mode !== "restore") {
    return Response.json({ error: "Unknown restore operation." }, { status: 400 });
  }
  // Next may normalize request.url to the server's internal hostname. The
  // incoming Host is the browser-facing authority used for this POST.
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`) {
    return Response.json({ error: "This upload must come from Data Settings." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json" || !request.body) {
    return Response.json({ error: "Choose a JSON backup file." }, { status: 415 });
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let jsonText = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BACKUP_BYTES) {
        await reader.cancel();
        return Response.json({ error: "Backup files must be 3 MiB or smaller." }, { status: 413 });
      }
      jsonText += decoder.decode(value, { stream: true });
    }
    jsonText += decoder.decode();
  } catch {
    return Response.json({ error: "Could not read the backup as UTF-8 JSON." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }

  try {
    return await restoreBackup(jsonText, mode);
  } catch {
    return Response.json({ error: "Could not confirm the backup operation. Check the workspace before retrying." }, { status: 500 });
  }
}
