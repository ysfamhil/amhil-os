import type { WorkspaceCounts } from "./workspace-backup";

type RpcError = { code: string; message: string };

export function backupOperationError(error: RpcError): Response {
  if (error.code === "42501") return Response.json({ error: "An approved account is required." }, { status: 403 });
  if (error.code === "55P03") return Response.json({ error: "Workspace data is busy. Please retry." }, { status: 409 });
  if (error.code === "22023") return Response.json({ error: error.message }, { status: 400 });
  if (error.code.startsWith("22") || error.code.startsWith("23")) {
    return Response.json({ error: "The backup contains invalid record values or relationships." }, { status: 400 });
  }
  return Response.json({ error: "The backup request failed. Check the workspace before retrying." }, { status: 500 });
}

export async function commitWorkspaceRestore(
  commit: () => PromiseLike<{ data: WorkspaceCounts; error: null } | { data: null; error: RpcError }>,
  invalidate: () => void,
  reportCacheError: (error: unknown) => void,
): Promise<Response> {
  const { data, error } = await commit();
  if (error) return backupOperationError(error);

  try {
    invalidate();
  } catch (error) {
    try {
      reportCacheError(error);
    } catch {
      // Reporting is also best-effort after a successful commit.
    }
  }

  // The RPC has committed. A cache failure cannot undo it.
  return Response.json({ restored: data });
}
