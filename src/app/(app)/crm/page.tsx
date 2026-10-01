import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCrmLeads } from "@/lib/queries/crm-leads";
import { CrmBoard } from "@/components/crm/crm-board";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const leads = await getCrmLeads(supabase, user.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-[28px] w-[5px] shrink-0 rounded-full bg-[var(--domain-crm)]" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">CRM</h1>
          <p className="mt-1.5 text-[13px] text-muted">Outreach prospects for your website design service.</p>
        </div>
      </div>

      <CrmBoard leads={leads} />
    </div>
  );
}
