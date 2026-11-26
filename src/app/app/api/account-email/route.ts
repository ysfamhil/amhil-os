import { createHash, timingSafeEqual } from "node:crypto";
import { ACCOUNT_EMAIL_KINDS, renderAccountEmail, type AccountEmailKind } from "@/lib/account-email";

/**
 * Sends one queued account e-mail through Resend. Called by the database job
 * (account_email_private.dispatch), which retries until it gets a 2xx.
 *
 * Not a user endpoint: no cookies, only the shared secret. Needs no database access, so the
 * application holds no service-role key. The caller chooses a kind and an address, never the text.
 * Nothing is logged: the request carries addresses.
 */
const digest = (value: string) => createHash("sha256").update(value).digest();
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

// Tests point at a fake mail service on this machine; the key is never sent anywhere else.
const resendUrl = () =>
  /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_URL ?? "") ? process.env.RESEND_API_URL! : "https://api.resend.com";

export async function POST(request: Request) {
  const secret = process.env.ACCOUNT_EMAIL_SECRET ?? "";
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const contact = process.env.ADMIN_NOTIFY_EMAIL ?? "";
  if (secret.length < 32 || !apiKey || !contact) return reply(503);
  if (!timingSafeEqual(digest(request.headers.get("x-account-email-secret") ?? ""), digest(secret))) return reply(401);

  let id: unknown, kind: unknown, email: unknown, name: unknown;
  try {
    const body = await request.text();
    if (body.length > 4000) return reply(413);
    ({ id, kind, email, name } = JSON.parse(body));
  } catch {
    return reply(400);
  }
  if (
    typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ||
    !ACCOUNT_EMAIL_KINDS.includes(kind as AccountEmailKind) ||
    typeof email !== "string" || email.length > 320 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+$/.test(email) ||
    (name !== null && typeof name !== "string")
  ) {
    return reply(400);
  }

  const message = renderAccountEmail(kind as AccountEmailKind, { email, name }, contact);
  try {
    const sent = await fetch(`${resendUrl()}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Retries of the same queue row are delivered once.
        "Idempotency-Key": `account-email/${id}`,
      },
      body: JSON.stringify({
        from: process.env.ACCOUNT_EMAIL_FROM || "AMHIL OS <no-reply@mail.byamhil.com>",
        to: [kind === "admin_new_registration" ? contact : email],
        reply_to: contact,
        ...message,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    return reply(sent.ok ? 204 : 502);
  } catch {
    return reply(502);
  }
}
