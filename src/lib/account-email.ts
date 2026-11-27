/**
 * The e-mails the application sends about accounts. Same look as the Supabase templates in
 * supabase/templates (a test keeps the two in step). No imports: also loaded directly by tests.
 */
export const ACCOUNT_EMAIL_KINDS = [
  "admin_new_registration",
  "account_approved",
  "account_declined",
  "account_suspended",
  "account_restored",
  "admin_delivery_failed",
] as const;
export type AccountEmailKind = (typeof ACCOUNT_EMAIL_KINDS)[number];

export const SITE_URL = "https://os.byamhil.com";

export interface AccountEmail {
  subject: string;
  html: string;
  text: string;
}

interface Content {
  subject: string;
  preheader: string;
  heading: string;
  lines: string[];
  button: string;
  href: string;
  note: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A name is typed by a stranger: one short line, no control characters. */
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").trim().slice(0, 80);

const FAILED_MESSAGES: Record<string, string> = {
  admin_new_registration: "new registration",
  account_approved: "account approved",
  account_declined: "registration not approved",
  account_suspended: "access suspended",
  account_restored: "access restored",
};

function content(kind: AccountEmailKind, account: { email: string; name: string | null }, contact: string): Content {
  const signIn = { button: "Sign in", href: `${SITE_URL}/app/login` };
  const write = { button: `Contact ${contact}`, href: `mailto:${contact}` };
  const about = "You received this because of your AMHIL OS account.";
  const admin = { button: "Open Admin", href: `${SITE_URL}/app/admin` };

  switch (kind) {
    case "admin_new_registration": {
      const name = oneLine(account.name ?? "");
      const who = name ? `${name} (${account.email})` : account.email;
      return {
        subject: "New AMHIL OS registration waiting for approval",
        preheader: "Someone confirmed their email address and is waiting for your approval.",
        heading: "New registration",
        lines: [`${who} confirmed their email address and is waiting for your approval.`],
        button: "Review in Admin",
        href: `${SITE_URL}/app/admin`,
        note: "Check that you know who this is before approving.",
      };
    }
    case "account_approved":
      return {
        subject: "Your AMHIL OS account is approved",
        preheader: "You can now sign in.",
        heading: "Your account is approved",
        lines: ["An administrator approved your account. You can now sign in with your email address and password."],
        ...signIn,
        note: about,
      };
    case "account_declined":
      return {
        subject: "Your AMHIL OS registration was not approved",
        preheader: "Your registration was not approved.",
        heading: "Registration not approved",
        lines: ["An administrator did not approve your registration, so you cannot use AMHIL OS.", "If you think this is a mistake, write to us."],
        ...write,
        note: about,
      };
    case "account_suspended":
      return {
        subject: "Your AMHIL OS access has been suspended",
        preheader: "Your access has been suspended.",
        heading: "Access suspended",
        lines: ["An administrator suspended your access to AMHIL OS.", "If you think this is a mistake, write to us."],
        ...write,
        note: about,
      };
    case "admin_delivery_failed": {
      // For this alert the name column says which message could not be sent.
      const message = FAILED_MESSAGES[account.name ?? ""] ?? "account";
      return {
        subject: "AMHIL OS could not send an account email",
        preheader: "An account email was given up on.",
        heading: "Email not sent",
        lines: [`The ${message} email to ${account.email} could not be sent after repeated attempts.`, "It will not be retried."],
        ...admin,
        note: "Check the address, and the sending service if this keeps happening.",
      };
    }
    case "account_restored":
      return {
        subject: "Your AMHIL OS access has been restored",
        preheader: "You can sign in again.",
        heading: "Access restored",
        lines: ["An administrator restored your access. You can sign in again."],
        ...signIn,
        note: about,
      };
  }
}

export function renderAccountEmail(
  kind: AccountEmailKind,
  account: { email: string; name: string | null },
  contact: string,
): AccountEmail {
  return layout(content(kind, account, contact));
}

/** Alert to the administrator about a message Resend reports as bounced, refused or marked as spam. */
export function renderDeliveryAlert(problem: { what: string; recipient: string; subject: string }): AccountEmail {
  return layout({
    subject: "AMHIL OS email problem: " + problem.what,
    preheader: "An email could not be delivered.",
    heading: "Email not delivered",
    // The recipient and subject come from outside: keep each to one short line.
    lines: [`${oneLine(problem.recipient)}: ${problem.what}.`, `Message: ${oneLine(problem.subject) || "(no subject)"}`],
    button: "Open Admin",
    href: `${SITE_URL}/app/admin`,
    note: "Details are in the Resend dashboard under Emails.",
  });
}

function layout(c: Content): AccountEmail {
  const logo = `${SITE_URL}/apple-icon.png`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(c.heading)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f1ef;">
    <div style="display:none; max-height:0; overflow:hidden;">${escapeHtml(c.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f1ef;">
      <tr>
        <td align="center" style="padding:28px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <tr>
              <td align="left" style="padding:0 0 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td><img src="${logo}" width="28" height="28" alt="" style="display:block; border:0; border-radius:7px;" /></td>
                    <td style="padding-left:9px; font-size:16px; font-weight:800; letter-spacing:-0.01em; color:#0a0a0c;">AMHIL OS</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border-radius:6px; padding:44px 40px 40px;">
                <h1 style="margin:0; font-size:28px; line-height:1.2; font-weight:800; letter-spacing:-0.02em; color:#0a0a0c;">${escapeHtml(c.heading)}</h1>
                <div style="border-top:1px solid #e4e4e1; margin:20px 0; font-size:0; line-height:0;">&nbsp;</div>
                <p style="margin:0 0 28px; font-size:15px; line-height:1.6; color:#55534e; overflow-wrap:anywhere; word-break:break-word;">
                  ${c.lines.map(escapeHtml).join("\n                  ")}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#e1fc66" style="border-radius:6px;">
                      <a href="${escapeHtml(c.href)}" style="display:block; padding:16px 20px; font-size:15px; font-weight:700; color:#0a0a0c; text-decoration:none;">${escapeHtml(c.button)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0; font-size:12px; line-height:1.6; color:#8a8882;">
                  ${escapeHtml(c.note)}
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 0 0;">
                <img src="${logo}" width="32" height="32" alt="AMHIL OS" style="display:block; border:0; border-radius:8px;" />
                <p style="margin:14px 0 0; font-size:11px; line-height:1.8; letter-spacing:0.08em; text-transform:uppercase; color:#8a8882;">
                  &copy; 2026 AMHIL OS<br />
                  <a href="${SITE_URL}" style="color:#8a8882; text-decoration:none;">os.byamhil.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
  // A "Contact <address>" button already says where it goes.
  const action = c.href.startsWith("mailto:") ? c.button : `${c.button}: ${c.href}`;
  const text = `${c.heading}\n\n${c.lines.join("\n")}\n\n${action}\n\n${c.note}\n`;
  return { subject: c.subject, html, text };
}
