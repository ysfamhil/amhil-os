import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  // The proxy already requires a session to reach this route at all — an
  // invalid or expired reset link fails in /app/auth/recovery (or, for older
  // links, /app/auth/callback) and lands on /app/login before ever getting here. This check is the same
  // defense-in-depth every other gated page in the app already has.
  const session = await getSessionProfile();
  if (!session) redirect("/app/login");

  // Naming the account lets someone notice a reset link that is not for them.
  return <ResetPasswordForm userId={session.userId} email={session.email} />;
}
