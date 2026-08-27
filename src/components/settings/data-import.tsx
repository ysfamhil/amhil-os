"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { previewImport, applyImport, type ImportPreview, type ImportResult } from "@/lib/actions/import";

export function DataImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoadError(null);
    setResult(null);
    setPreview(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const text = await file.text();
      setJsonText(text);
      const p = await previewImport(text);
      setPreview(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to read that file.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!jsonText) return;
    setApplying(true);
    try {
      const res = await applyImport(jsonText);
      setResult(res);
    } finally {
      setApplying(false);
    }
  }

  function reset() {
    setJsonText(null);
    setFileName(null);
    setPreview(null);
    setResult(null);
    setLoadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Card>
      <CardHeader title="Import" />
      <p className="mb-3 text-sm text-muted">
        Restore from an <code className="rounded bg-background px-1">amhil-os-export.json</code> backup. Imported
        records are always added as new copies — nothing existing is ever overwritten.
      </p>

      {!fileName && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted hover:border-accent hover:text-accent">
          <Upload size={16} />
          Choose a JSON file…
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      )}

      {fileName && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="text-muted">File:</span> {fileName}
          </p>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Validating…
            </p>
          )}

          {loadError && (
            <div>
              <p className="text-sm text-danger">{loadError}</p>
              <button type="button" onClick={reset} className="mt-2 text-xs font-medium text-accent hover:underline">
                Try another file
              </button>
            </div>
          )}

          {preview && !result && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-sm font-medium">
                {Object.values(preview.counts).reduce((a, b) => a + b, 0)} records ready to import:
              </p>
              <ul className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
                {Object.entries(preview.counts).map(([table, count]) => (
                  <li key={table}>
                    {count} {table}
                  </li>
                ))}
              </ul>
              {Object.values(preview.duplicates).some((c) => c > 0) && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} />
                  Some ids already exist in your account — they&apos;ll be imported as new copies, not merged.
                </p>
              )}
              {!preview.valid && (
                <div className="mb-2 text-xs text-danger">
                  <p className="mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {preview.errors.length} validation error(s):
                  </p>
                  <ul className="list-disc pl-5">
                    {preview.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        {e.table}[{e.index}]: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-border/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!preview.valid || applying}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? "Importing…" : "Ready to import?"}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-lg border p-3 text-sm ${result.ok ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
              {result.ok ? (
                <p className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 size={14} /> Imported {Object.values(result.inserted).reduce((a, b) => a + b, 0)} records.
                </p>
              ) : (
                <p className="text-danger">{result.error}</p>
              )}
              <button type="button" onClick={reset} className="mt-2 text-xs font-medium text-accent hover:underline">
                Import another file
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
