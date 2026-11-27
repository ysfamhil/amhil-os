/** Shared between signup and reset-password so the two never drift apart.
 * Matches the `minimum_password_length` Supabase itself enforces. */
export const MIN_PASSWORD_LENGTH = 6;

/** Whether the login screen offers "Sign up". Mirrors the Supabase "Allow new users to sign up"
 * setting; Supabase enforces it either way. New accounts still wait for an administrator. */
export const PUBLIC_SIGNUP_ENABLED: boolean = true;
