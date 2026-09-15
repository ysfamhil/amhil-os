import type { ReactNode } from "react";

/**
 * Shared outer card for every unauthenticated screen (login, signup, forgot/
 * reset password) so the AMHIL OS brand mark and card treatment stay
 * consistent — the `icon` prop is what actually differentiates a
 * credential-entry screen (login/signup, no icon) from an account-recovery
 * screen (forgot/reset password, badge icon), the same pattern /pending
 * already uses for its own status badge.
 */
export function AuthShell({
  subtitle,
  icon,
  children,
}: {
  subtitle: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          {icon && (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-a13 text-accent">
              {icon}
            </div>
          )}
          <p className="text-lg font-semibold tracking-tight">AMHIL OS</p>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
