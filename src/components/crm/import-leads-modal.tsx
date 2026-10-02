"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { importCrmLeads } from "@/lib/actions/crm-leads";

type Row = Record<string, string>;

export function ImportLeadsModal({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  function handleClose() {
    const wasImported = result !== null;
    setResult(null);
    setError(null);
    onClose();
    if (wasImported) router.refresh();
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await importCrmLeads(
        rows.map((r) => ({
          name: r.name,
          website: r.website,
          contact: r.contact,
          status: r.status,
          date: r.date,
          notes: r.notes,
        }))
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import leads" size="lg">
      {result ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {result.imported} {result.imported === 1 ? "lead" : "leads"} imported, {result.skipped} skipped as
            duplicates
          </p>
          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No rows found in this file.</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Preview of {rows.length} {rows.length === 1 ? "row" : "rows"}. Leads with a website that already
                exists are skipped; an empty status becomes &quot;New&quot;.
              </p>
              <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-[0.07em] text-t5">
                      {["Name", "Website", "Contact", "Status", "Date", "Notes"].map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-line2 last:border-b-0">
                        <td className="px-3 py-2 font-medium">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-t4">{r.website || "—"}</td>
                        <td className="px-3 py-2 text-t4">{r.contact || "—"}</td>
                        <td className="px-3 py-2 text-t4">{r.status || "New"}</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-t6">{r.date || "—"}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-t4">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending || rows.length === 0}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Importing…" : `Import ${rows.length} ${rows.length === 1 ? "lead" : "leads"}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
