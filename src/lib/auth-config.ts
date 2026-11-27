/** Shared between signup and reset-password so the two never drift apart.
 * Matches the `minimum_password_length` Supabase itself enforces. */
export const MIN_PASSWORD_LENGTH = 6;

/** Cloudflare Turnstile site key (public). Empty means no CAPTCHA is configured. */
export const CAPTCHA_SITE_KEY: string = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Whether the login screen offers "Sign up": never without CAPTCHA protection. Supabase's own
 * "Allow new users to sign up" and CAPTCHA settings are what enforce it; new accounts still wait
 * for an administrator. */
export const PUBLIC_SIGNUP_ENABLED: boolean = CAPTCHA_SITE_KEY !== "";
