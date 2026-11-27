import { renderDeliveryAlert } from "@/lib/account-email";
import { deliveryProblem, isSignedByResend } from "@/lib/email-events";

/**
 * Resend webhook: tells the administrator when one of this application's e-mails bounces, is
 * refused or is marked as spam. History stays in the Resend dashboard.
 *
 * Not a user endpoint: no cookies, only a request signed by Resend is read. Needs no database access.
 * Nothing is logged: events carry addresses. A non-200 answer makes Resend try again later, and the
 * event id is the idempotency key, so a repeat does not alert twice.
 */
const noStore = { "Cache-Control": "no-store" };
const reply = (status: number) => new Response(null, { status, headers: noStore });
const MAX_BYTES = 20_000;

// Tests point at a fake mail service on this machine; the key is never sent anywhere else.
const resendUrl = () =>
  /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_URL ?? "") ? process.env.RESEND_API_URL! : "https://api.resend.com";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const contact = process.env.ADMIN_NOTIFY_EMAIL ?? "";
  if (!secret || !apiKey || !contact) return reply(503);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return reply(413);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return reply(400);
  }
  if (body.length > MAX_BYTES) return reply(413);
  if (!isSignedByResend(secret, request.headers, body)) return reply(401);

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return reply(400);
  }
  const problem = deliveryProblem(event, contact);
  if (!problem) return reply(200);

  try {
    const sent = await fetch(`${resendUrl()}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `email-event/${request.headers.get("svix-id")}`,
      },
      body: JSON.stringify({
        from: process.env.ACCOUNT_EMAIL_FROM || "AMHIL OS <no-reply@mail.byamhil.com>",
        to: [contact],
        ...renderDeliveryAlert(problem),
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    return reply(sent.ok ? 200 : 502);
  } catch {
    return reply(502);
  }
}
