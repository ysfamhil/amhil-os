# Auth e-mail templates

Pasted by hand into Supabase → Authentication → Emails. Editing a file here changes nothing in Supabase.

| File | Supabase template | Subject | Button leads to |
|---|---|---|---|
| `recovery.html` | Reset password | Reset your AMHIL OS password | `{{ .SiteURL }}/app/auth/recovery#token_hash={{ .TokenHash }}` |
| `confirm-signup.html` | Confirm sign up | Confirm your AMHIL OS email address | `{{ .ConfirmationURL }}` |
| `password-changed.html` | Security: Password changed | Your AMHIL OS password was changed | `{{ .SiteURL }}/app/forgot-password` |
| `email-changed.html` | Security: Email address changed | Your AMHIL OS email address was changed | `mailto:hello@byamhil.com` |

The two security notices are also switched on or off in Supabase, separately from their content.
