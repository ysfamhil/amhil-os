"use client";

import { useEffect, useRef, useState } from "react";
import { CAPTCHA_SITE_KEY } from "@/lib/auth-config";

/**
 * Cloudflare Turnstile for the forms Supabase can protect: sign-in, sign-up and "forgot password".
 * Supabase verifies the token; this only collects it. Renders nothing, and loads nothing from
 * Cloudflare, unless a site key is configured.
 */
interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widget: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** A token can be used once: call reset() after every attempt. */
export function useCaptcha() {
  const [token, setToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  return {
    token: token || undefined,
    /** True while a protected form must not be sent yet. */
    waiting: CAPTCHA_SITE_KEY !== "" && !token,
    reset: () => {
      setToken("");
      setAttempt((n) => n + 1);
    },
    widget: { onToken: setToken, attempt },
  };
}

export function Captcha({ onToken, attempt }: { onToken: (token: string) => void; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY) return;
    let widget: string | undefined;
    let cancelled = false;
    loadTurnstile().then(
      () => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget = window.turnstile.render(ref.current, {
          sitekey: CAPTCHA_SITE_KEY,
          size: "flexible",
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [onToken, attempt]);

  if (!CAPTCHA_SITE_KEY) return null;
  return failed ? (
    <p className="text-sm text-danger">The security check could not load. Reload the page and try again.</p>
  ) : (
    <div ref={ref} className="min-h-[65px] w-full" />
  );
}
