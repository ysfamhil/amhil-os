import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { runAutomationChecks } from "@/lib/automation";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function fullDate() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [data, , profileRes, goalsRes, tasksRes] = await Promise.all([
    getDashboardData(supabase, user.id),
    runAutomationChecks(supabase, user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("goals").select("id,title").eq("user_id", user.id).order("title"),
    supabase.from("tasks").select("id,title").eq("user_id", user.id).order("title"),
  ]);

  const firstName = profileRes.data?.full_name?.trim().split(" ")[0];

  return (
    <div className="mx-auto flex h-full max-w-[1560px] flex-col gap-4 lg:min-h-0">
      <div className="shrink-0 flex items-center gap-3">
        <span className="h-[30px] w-[5px] shrink-0 rounded-full bg-accent" />
        <div>
          <h1 className="text-[32px] font-extrabold leading-none tracking-[-0.03em]">Overview</h1>
          <p className="mt-1.5 font-mono text-[12px] text-t6">
            {greeting()}{firstName ? `, ${firstName}` : ""} · {fullDate()}
          </p>
        </div>
      </div>

      <OverviewClient
        data={data}
        goalOptions={goalsRes.data ?? []}
        taskOptions={tasksRes.data ?? []}
      />
    </div>
  );
}
