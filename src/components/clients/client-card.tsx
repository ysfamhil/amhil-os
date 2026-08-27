import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Client, ClientStatus } from "@/types/database";

const STATUS_TONE: Record<ClientStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  Lead: "neutral",
  Contacted: "accent",
  Proposal: "accent",
  Negotiation: "warning",
  Won: "success",
  Lost: "danger",
  Client: "success",
  Inactive: "neutral",
};

export function ClientCard({ client }: { client: Client }) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="flex h-full flex-col gap-2 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium">{client.name}</h3>
            {client.company && <p className="text-sm text-muted">{client.company}</p>}
          </div>
          <Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge>
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 text-xs text-muted">
          {client.email && <span>{client.email}</span>}
          {client.country && <span>{client.country}</span>}
        </div>
      </Card>
    </Link>
  );
}
