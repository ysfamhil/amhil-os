import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmergencyFundById } from "@/lib/queries/emergency-fund";
import { FundDetailClient } from "@/components/finance/fund-detail-client";

export default async function FundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fund = await getEmergencyFundById(supabase, user.id, id);
  if (!fund) {
    notFound();
  }

  return <FundDetailClient fund={fund} />;
}
