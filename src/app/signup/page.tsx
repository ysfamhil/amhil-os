"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, TextInput } from "@/components/ui/field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-config";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    // full_name only ever reaches profiles via handle_new_user() reading
    // raw_user_meta_data — that trigger decides role/status on its own from
    // the email alone, so nothing here can influence access level.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() || null } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthShell subtitle="Check your email">
        <p className="text-center text-sm text-muted">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Confirm it,
          then sign in — an admin will still need to approve your account before you can get in.
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
    <AuthShell subtitle="Create your account to get started">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="full-name">
          <TextInput
            id="full-name"
            type="text"
            required
            autoComplete="name"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="Confirm password" htmlFor="confirm-password">
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
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
