"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { explainReport } from "@/lib/actions/ai";

export function ExplainReportButton({ reportName, data }: { reportName: string; data: unknown }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    try {
      const result = await explainReport(reportName, data);
      if (result.ok) setText(result.text);
      else setError(result.text);
    } catch {
      setError("AI insights are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  if (text) {
    return (
      <div className="rounded-lg border border-border bg-background p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Sparkles size={12} /> AI explanation
        </p>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExplain}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {loading ? "Analyzing…" : "Explain this report"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
