"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, TextInput } from "@/components/ui/field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-config";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // The recovery session is single-purpose — drop it once the password is
    // set so the user comes back through a normal sign-in, not a lingering
    // recovery grant.
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell subtitle="Password updated" icon={<KeyRound size={20} />}>
        <p className="text-center text-sm text-muted">
          Your password has been reset. Sign in with your new password to continue.
        </p>
        <Link
          href="/login"
          className="mt-5 block rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Choose a new password" icon={<KeyRound size={20} />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="New password" htmlFor="password">
          <TextInput
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-password">
          <TextInput
            id="confirm-password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Reset password"}
        </button>
      </form>
    </AuthShell>
  );
}
