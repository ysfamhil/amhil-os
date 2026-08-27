import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientById } from "@/lib/queries/clients";
import { ClientDetailClient, type ActivityItem } from "@/components/clients/client-detail-client";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getClientById(supabase, user.id, id);
  if (!detail) {
    notFound();
  }

  const activity: ActivityItem[] = detail.projects
    .map((project) => ({
      id: `${project.id}-created`,
      label: `Project created: ${project.name}`,
      at: project.created_at,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return <ClientDetailClient detail={detail} activity={activity} />;
}
