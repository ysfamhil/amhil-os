"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { EntityNotes } from "@/components/notes/entity-notes";
import { deleteClientRecord } from "@/lib/actions/clients";
import type { ClientDetail } from "@/lib/queries/clients";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export interface ActivityItem {
  id: string;
  label: string;
  at: string;
}

export function ClientDetailClient({ detail, activity }: { detail: ClientDetail; activity: ActivityItem[] }) {
  const router = useRouter();
  const { client, projects, finance } = detail;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
            <Badge tone="accent">{client.status}</Badge>
          </div>
          {client.company && <p className="mt-1 text-sm text-muted">{client.company}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      <Card>
        <CardHeader title="Overview" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <Stat label="Email" value={client.email ?? "—"} />
          <Stat label="Phone" value={client.phone ?? "—"} />
          <Stat label="Country" value={client.country ?? "—"} />
          <Stat label="Source" value={client.source ?? "—"} />
        </div>
        {client.notes && <p className="mt-4 text-sm text-muted">{client.notes}</p>}
      </Card>

      <Card>
        <CardHeader title="Finance" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Paid revenue" value={`${money(finance.totalPaid)} MAD`} tone="success" />
          <Stat label="Invoiced" value={`${money(finance.invoiced)} MAD`} />
          <Stat label="Expected" value={`${money(finance.expected)} MAD`} />
          <Stat label="Income records" value={String(finance.incomeRecordCount)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Projects"
          action={
            <button
              type="button"
              onClick={() => setProjectModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              <Plus size={14} />
              New Project
            </button>
          }
        />
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Create the first project for this client." />
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`} className="flex items-center justify-between text-sm hover:underline">
                  <span>{project.name}</span>
                  <Badge tone="neutral">{project.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <EntityNotes clientId={client.id} clientLabel={client.name} />
      </Card>

      <Card>
        <CardHeader title="Activity" />
        {activity.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className="text-xs text-muted">
                  {new Date(item.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ClientFormModal open={editOpen} onClose={() => setEditOpen(false)} client={client} />

      <ProjectFormModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        clients={[{ id: client.id, name: client.name }]}
        defaultClientId={client.id}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete client"
        description={`Delete "${client.name}"? Their projects and income records stay intact and just become unlinked. This can't be undone.`}
        onConfirm={async () => {
          await deleteClientRecord(client.id);
          router.push("/clients");
          router.refresh();
        }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-semibold ${tone === "success" ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}
