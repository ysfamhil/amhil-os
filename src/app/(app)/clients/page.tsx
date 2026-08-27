import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/lib/queries/clients";
import { ClientsBoard } from "@/components/clients/clients-board";
import type { ClientStatus } from "@/types/database";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;

  const clients = await getClients(supabase, user.id, {
    q: typeof sp.q === "string" ? sp.q : undefined,
    status: typeof sp.status === "string" ? (sp.status as ClientStatus) : undefined,
    sort: typeof sp.sort === "string" ? (sp.sort as "name" | "created_at" | "status") : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted">A lightweight CRM for the people and companies you work with.</p>
      </div>

      <ClientsBoard clients={clients} />
    </div>
  );
}
