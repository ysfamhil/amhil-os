"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, TextInput } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    // Supabase never reports "no account with that email" for this call —
    // intentionally, to avoid confirming or denying an email is registered.
    // Show the same success state on any non-throwing response so the app
    // doesn't accidentally reintroduce that leak on its own.
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell subtitle="Check your email" icon={<Mail size={20} />}>
        <p className="text-center text-sm text-muted">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent a
          link to reset your password. It expires soon, so use it shortly after it arrives.
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
    <AuthShell subtitle="Reset your password" icon={<Mail size={20} />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
