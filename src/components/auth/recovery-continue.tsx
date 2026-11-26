"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { verifyRecoveryToken } from "@/lib/actions/recovery";

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
// The token is kept only in memory once read, because it is then removed from the address bar.
let captured = "";
const readToken = () => {
  const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("token_hash");
  if (fromAddress) captured = fromAddress;
  return captured;
};

function ContinueButton({ leaving }: { leaving: boolean }) {
  const status = useFormStatus();
  const pending = status.pending || leaving;
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Checking…" : "Continue"}
    </button>
  );
}

export function RecoveryContinue() {
  // null while rendering on the server, where the part of the address after "#" does not exist.
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const [state, formAction] = useActionState(verifyRecoveryToken, { signedIn: false, next: null });

  // A full page load (not client-side navigation): see verifyRecoveryToken.
  useEffect(() => {
    if (state.next) window.location.replace(state.next);
  }, [state.next]);

  // Remove the token from the address bar and history as soon as it is held in memory. This sends
  // nothing and verifies nothing.
  useEffect(() => {
    if (token && window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [token]);

  return (
    <AuthShell subtitle="Reset your password" icon={<KeyRound size={20} />}>
      {token === "" ? (
        <p className="text-center text-sm text-muted">
          This reset link is incomplete.{" "}
          {/* A plain link: full page load on purpose. */}
          <a href="/app/forgot-password" className="font-medium text-foreground hover:underline">
            Request a new one
          </a>
        </p>
      ) : state.signedIn ? (
        <p className="text-center text-sm text-muted">
          You are signed in on this device. Sign out first, then open the link from your e-mail again. The link has not
          been used.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted">Continue to choose a new password. The link works once.</p>
          <input type="hidden" name="token_hash" value={token ?? ""} />
          <ContinueButton leaving={Boolean(state.next)} />
        </form>
      )}
    </AuthShell>
  );
}
