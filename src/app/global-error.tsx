"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-4 text-center text-foreground">
        <p className="text-sm font-medium">AMHIL OS couldn&apos;t load</p>
        <p className="max-w-xs text-sm text-muted">Your data is safe — try reloading the page.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
