import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCOUNT_EMAIL_KINDS, renderAccountEmail, type AccountEmailKind } from "@/lib/account-email";

/**
 * Sends one queued account e-mail through Resend. Called by the database job
 * (account_email_private.dispatch), which retries until this answers 200 with the message id.
 *
 * Not a user endpoint: no cookies. The job signs "<time>.<body>" with the shared secret, so the
 * secret itself is never transmitted and a request cannot be altered or replayed later. Needs no
 * database access, so the application holds no service-role key. The caller chooses a kind and an
 * address, never the text. Nothing is logged: the request carries addresses.
 */
const noStore = { "Cache-Control": "no-store" };
const reply = (status: number) => new Response(null, { status, headers: noStore });
// How far apart the two clocks may be, and how long a captured request stays usable.
const MAX_AGE_SECONDS = 300;

function signedBy(secret: string, request: Request, body: string): boolean {
  const time = request.headers.get("x-account-email-time") ?? "";
  const signature = request.headers.get("x-account-email-signature") ?? "";
  if (!/^\d{10}$/.test(time) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - Number(time)) > MAX_AGE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${time}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

// Tests point at a fake mail service on this machine; the key is never sent anywhere else.
const resendUrl = () =>
  /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_URL ?? "") ? process.env.RESEND_API_URL! : "https://api.resend.com";

export async function POST(request: Request) {
  const secret = process.env.ACCOUNT_EMAIL_SECRET ?? "";
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const contact = process.env.ADMIN_NOTIFY_EMAIL ?? "";
  if (secret.length < 32 || !apiKey || !contact) return reply(503);
  if (Number(request.headers.get("content-length") ?? 0) > 4000) return reply(413);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return reply(400);
  }
  if (body.length > 4000) return reply(413);
  if (!signedBy(secret, request, body)) return reply(401);

  let id: unknown, kind: unknown, email: unknown, name: unknown;
  try {
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
    return sent.ok ? Response.json({ sent: id }, { headers: noStore }) : reply(502);
  } catch {
    return reply(502);
  }
}
