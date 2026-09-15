import { redirect } from "next/navigation";
import { Clock, ShieldOff } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function PendingPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  if (session.profile?.status === "approved") redirect("/dashboard");

  const suspended = session.profile?.status === "suspended";

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            suspended ? "bg-r13 text-red" : "bg-am13 text-amber"
          }`}
        >
          {suspended ? <ShieldOff size={22} /> : <Clock size={22} />}
        </div>

        <p className="mt-4 text-lg font-semibold tracking-tight">
          {suspended ? "Account suspended" : "Awaiting approval"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {suspended
            ? "Your access to AMHIL OS has been suspended. If you think this is a mistake, reach out to the owner."
            : `Your email is confirmed — thanks for signing up. An admin still needs to approve ${session.email ?? "your account"} before you can get in. You'll be able to sign in as soon as that happens.`}
        </p>

        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
