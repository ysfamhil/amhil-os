import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Account and application preferences.</p>
      </div>

      <Card>
        <CardHeader title="My Profile" />
        <ProfileForm fullName={profile?.full_name ?? null} avatarUrl={profile?.avatar_url ?? null} />
      </Card>

      <Card>
        <CardHeader title="Account" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-1 text-sm font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Member since</dt>
            <dd className="mt-1 text-sm font-medium">
              {new Date(user.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-border pt-4">
          <SignOutButton />
        </div>
      </Card>

      <Card>
        <CardHeader title="Data & Backup" />
        <p className="mb-3 text-sm text-muted">Export your data as CSV or a full JSON backup, or restore from one.</p>
        <Link
          href="/settings/data"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Open Data & Backup →
        </Link>
      </Card>
    </div>
  );
}
