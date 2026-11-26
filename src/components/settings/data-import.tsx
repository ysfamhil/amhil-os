"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { MAX_BACKUP_BYTES, type RestorePreview, type WorkspaceCounts } from "@/lib/workspace-backup";

type RestoreResponse = {
  error?: string;
  preview?: RestorePreview;
  restored?: WorkspaceCounts;
};

const UNKNOWN_OUTCOME = "تعذّر تأكيد نتيجة الاستعادة. تحقّق من مساحة العمل قبل المحاولة مرة أخرى.";
class RestoreOutcomeUnknown extends Error {}

async function uploadBackup(file: File, mode: "preview" | "restore") {
  let response: Response;
  try {
    response = await fetch(`/app/settings/data/restore?mode=${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: file,
      redirect: "error",
    });
  } catch (error) {
    if (mode === "restore") throw new RestoreOutcomeUnknown();
    throw error;
  }

  if (mode === "restore" && response.status >= 500) throw new RestoreOutcomeUnknown();
  const result = await response.json().catch(() => null) as RestoreResponse | null;
  if (!response.ok) throw new Error(result?.error ?? "The backup request failed.");
  if (mode === "restore" && !result?.restored) throw new RestoreOutcomeUnknown();
  if (!result) throw new Error("The server did not return a restore preview.");
  return result;
}

export function DataImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [restored, setRestored] = useState<WorkspaceCounts | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);

  function clear() {
    setFile(null);
    setPreview(null);
    setRestored(null);
    setError(null);
    setOutcomeUnknown(false);
  }

  async function handleFile(selected: File) {
    clear();
    setFile(selected);
    if (selected.size > MAX_BACKUP_BYTES) {
      setError("Backup files must be 3 MiB or smaller.");
      return;
    }
    await checkEligibility(selected);
  }

  async function checkEligibility(selected: File) {
    setError(null);
    setPreview(null);
    setPending(true);
    try {
      const result = await uploadBackup(selected, "preview");
      if (!result.preview) throw new Error("The server did not return a restore preview.");
      setPreview(result.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate this backup.");
    } finally {
      setPending(false);
    }
  }

  async function handleRestore() {
    if (!file || !preview?.empty || pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await uploadBackup(file, "restore");
      if (!result.restored) throw new RestoreOutcomeUnknown();
      setRestored(result.restored);
      setOutcomeUnknown(false);
      router.refresh();
    } catch (err) {
      if (err instanceof RestoreOutcomeUnknown) {
        setPreview(null);
        setOutcomeUnknown(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not restore this backup.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Restore" />
      <p className="mb-3 text-sm text-muted">
        Restore an AMHIL OS JSON backup of up to 3 MiB into an empty workspace.
      </p>

      {!file && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted hover:border-accent hover:text-accent">
          <Upload size={16} />
          Choose a JSON backup
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void handleFile(selected);
            }}
          />
        </label>
      )}

      {file && (
        <div className="flex flex-col gap-3">
          <p className="break-all text-sm">{file.name}</p>
          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" />
              {preview ? "Restoring…" : "Validating…"}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {outcomeUnknown && (
            <p role="alert" lang="ar" dir="rtl" className="text-sm text-warning">{UNKNOWN_OUTCOME}</p>
          )}
          {outcomeUnknown && (
            <button type="button" disabled={pending} onClick={() => void checkEligibility(file)}
              className="self-start text-sm font-medium text-accent hover:underline disabled:opacity-50">
              Check workspace eligibility
            </button>
          )}

          {preview && !restored && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-sm font-medium">Version {preview.version} backup</p>
              <ul className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
                {Object.entries(preview.counts).map(([table, count]) => (
                  <li key={table}>{count} {table.replaceAll("_", " ")}</li>
                ))}
              </ul>
              {preview.omitted.length > 0 && (
                <p className="mb-2 text-xs text-warning">Missing from this backup: {preview.omitted.join(", ")}.</p>
              )}
              {preview.warnings.map((warning) => <p key={warning} className="mb-2 text-xs text-warning">{warning}</p>)}
              {!preview.empty && <p className="mb-2 text-sm text-warning">Restore requires an empty workspace. Back up or reset existing data first.</p>}
              <button
                type="button"
                onClick={handleRestore}
                disabled={!preview.empty || pending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
              >
                Confirm restore
              </button>
            </div>
          )}

          {restored && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 size={14} /> Restored {Object.values(restored).reduce((total, count) => total + count, 0)} records.
            </p>
          )}
          <button type="button" disabled={pending} onClick={clear} className="self-start text-xs font-medium text-accent hover:underline disabled:opacity-50">
            Choose another file
          </button>
        </div>
      )}
    </Card>
  );
}
