import type { Metadata } from "next";
import { RecoveryContinue } from "@/components/auth/recovery-continue";

export const metadata: Metadata = { title: "Reset your password · AMHIL OS", robots: { index: false, follow: false } };

/**
 * Where the password-reset e-mail points: /app/auth/recovery#token_hash=...
 * Opening it changes nothing, so mail scanners that fetch links cannot use up the token. The token
 * stays after "#", which browsers never send to a server or write to its logs.
 */
export default function RecoveryPage() {
  return <RecoveryContinue />;
}
