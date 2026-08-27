"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Users, Plus } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { Client, ClientStatus } from "@/types/database";

const STATUSES: ClientStatus[] = [
  "Lead",
  "Contacted",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
  "Client",
  "Inactive",
];

export function ClientsBoard({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value || null }), 300);
  }

  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? "created_at";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search clients…"
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="created_at">Sort: Newest</option>
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
        </select>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Client
        </button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add a client to start tracking their projects and revenue."
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Client
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
