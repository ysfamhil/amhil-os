"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { updateProfile } from "@/lib/actions/profile";

export function ProfileForm({ fullName, avatarUrl }: { fullName: string | null; avatarUrl: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(fullName ?? "");
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      await updateProfile({ full_name: name, avatar_url: avatar });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="profile-name">
        <TextInput
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </Field>

      <Field label="Avatar URL" htmlFor="profile-avatar">
        <TextInput
          id="profile-avatar"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !error && <p className="text-sm text-success">Saved.</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
