import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeLeadAnalytics, getLeads } from "@/lib/queries/leads";
import { LeadsBoard } from "@/components/leads/leads-board";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const leads = await getLeads(supabase, user.id);
  const analytics = computeLeadAnalytics(leads);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted">Your sales pipeline, from first contact to won.</p>
      </div>

      <LeadsBoard leads={leads} analytics={analytics} />
    </div>
  );
}
