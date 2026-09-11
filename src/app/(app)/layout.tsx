import { AppHeader } from "@/components/layout/app-header";
import { CommandPalette } from "@/components/search/command-palette";
import { createClient } from "@/lib/supabase/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [notifications, unreadCount, profileRes] = user
    ? await Promise.all([
        getNotifications(supabase, user.id),
        getUnreadNotificationCount(supabase, user.id),
        supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle(),
      ])
    : [[], 0, { data: null }];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <AppHeader
        fullName={profileRes.data?.full_name ?? null}
        email={user?.email ?? null}
        avatarUrl={profileRes.data?.avatar_url ?? null}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
