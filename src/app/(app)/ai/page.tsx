import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/ai/assistant-chat";

export default async function AIPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted">Ask questions about your own AMHIL OS data — answers are grounded in your real records.</p>
      </div>

      <AssistantChat />
    </div>
  );
}
