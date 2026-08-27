"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { exportEntityCSV, exportFullJSON } from "@/lib/actions/export";
import { CSV_ENTITIES, type CSVEntity } from "@/lib/export-entities";

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ENTITY_LABELS: Record<CSVEntity, string> = {
  tasks: "Tasks",
  projects: "Projects",
  goals: "Goals",
  learning: "Learning",
  habits: "Habits",
  time: "Time entries",
  clients: "Clients",
  leads: "Leads",
  income: "Income",
  expenses: "Expenses",
  notes: "Notes",
  timeline: "Timeline",
};

export function DataExport() {
  const [pending, setPending] = useState<string | null>(null);

  async function handleCSV(entity: CSVEntity) {
    setPending(entity);
    try {
      const { filename, csv } = await exportEntityCSV(entity);
      downloadText(filename, csv, "text/csv");
    } finally {
      setPending(null);
    }
  }

  async function handleFullJSON() {
    setPending("full");
    try {
      const { filename, json } = await exportFullJSON();
      downloadText(filename, json, "application/json");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Export" />
      <p className="mb-3 text-sm text-muted">Per-entity CSV, or one full JSON backup that preserves relationships between records.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {CSV_ENTITIES.map((entity) => (
          <button
            key={entity}
            type="button"
            onClick={() => handleCSV(entity)}
            disabled={pending !== null}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {ENTITY_LABELS[entity]}
            {pending === entity ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleFullJSON}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending === "full" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export All Data (JSON)
        </button>
      </div>
    </Card>
  );
}
