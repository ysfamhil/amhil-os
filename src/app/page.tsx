import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const description = "Tasks, goals, habits, time, notes, journal and finances, in a private workspace.";

export const metadata: Metadata = { title: "AMHIL OS", description };

/** Public landing page at "/". Static: it reads no session and no data. */
export default function LandingPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-[9px] py-6">
        <span
          aria-hidden="true"
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-accent font-mono text-[14px] font-bold text-accent-foreground"
        >
          A
        </span>
        <span className="text-[15px] font-extrabold tracking-[-0.01em]">AMHIL OS</span>
      </header>

      {/* The bottom padding balances the header so the block sits at the optical centre. */}
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center pb-24 text-center">
        <h1 className="text-balance text-[40px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[64px]">
          Your life and work, in one quiet place.
        </h1>
        <p className="mt-6 max-w-md text-pretty text-[16px] leading-relaxed text-muted sm:text-[18px]">{description}</p>
        <Link
          href="/app"
          className="mt-10 inline-flex h-12 items-center gap-2 rounded-[10px] bg-accent px-6 text-[15px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Enter workspace
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
