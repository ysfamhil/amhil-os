/**
 * Delivery events posted by Resend: is the request genuine, and does it deserve an alert?
 * No imports besides node's crypto: also loaded directly by tests.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 300;
/** Only this application's mail; the Resend account also sends for other projects. */
export const SENDING_DOMAIN = "mail.byamhil.com";

const PROBLEMS: Record<string, string> = {
  "email.bounced": "bounced",
  "email.complained": "marked as spam",
  "email.failed": "could not be sent",
  "email.suppressed": "not sent because the address is suppressed",
};

/** Resend signs with the Svix scheme: HMAC-SHA256 over "id.timestamp.body". */
export function isSignedByResend(secret: string, headers: Headers, body: string, now = Date.now()): boolean {
  const id = headers.get("svix-id") ?? "";
  const time = headers.get("svix-timestamp") ?? "";
  const signatures = headers.get("svix-signature") ?? "";
  if (!secret.startsWith("whsec_") || !/^[\w-]{1,128}$/.test(id) || !/^\d{10}$/.test(time)) return false;
  if (Math.abs(now / 1000 - Number(time)) > MAX_AGE_SECONDS) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (key.length < 16) return false;
  const expected = createHmac("sha256", key).update(`${id}.${time}.${body}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, value] = part.split(",");
    const given = Buffer.from(value ?? "", "base64");
    return version === "v1" && given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const address = (value: string) => (/<([^<>]+)>\s*$/.exec(value)?.[1] ?? value).trim().toLowerCase();

/** The alert an event calls for, or null when there is nothing to tell. */
export function deliveryProblem(event: unknown, contact: string): { what: string; recipient: string; subject: string } | null {
  const { type, data } = (event ?? {}) as { type?: unknown; data?: { from?: unknown; to?: unknown; subject?: unknown } };
  const what = typeof type === "string" ? PROBLEMS[type] : undefined;
  if (!what || !data || typeof data.from !== "string" || !address(data.from).endsWith(`@${SENDING_DOMAIN}`)) return null;
  // Never alert about the alert address itself: that could go round for ever.
  const recipients = (Array.isArray(data.to) ? data.to : [data.to])
    .filter((to): to is string => typeof to === "string")
    .map(address)
    .filter((to) => to && to !== contact.toLowerCase());
  if (!recipients.length) return null;
  return { what, recipient: recipients.slice(0, 3).join(", "), subject: typeof data.subject === "string" ? data.subject : "" };
}
