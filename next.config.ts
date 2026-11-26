import type { NextConfig } from "next";

/**
 * Content-Security-Policy: deliberately limited to the directives that are safe to enforce without
 * knowing every resource the app loads. They stop the app being framed (clickjacking), stop injected
 * <base> tags from re-pointing relative URLs, stop forms posting to another origin, and disable
 * plugins.
 *
 * There is intentionally NO script-src yet. The app ships inline scripts of its own (the theme script
 * in the root layout) and Next.js injects inline bootstrap scripts into every page, so a script-src
 * that is not 'unsafe-inline' needs a per-request nonce created in proxy.ts, which in turn forces
 * dynamic rendering of the currently static pages (/login, /signup, /forgot-password). That is a
 * larger change with its own risk of breaking pages, so it is left as a separate step rather than
 * adding a script-src that looks protective while allowing 'unsafe-inline'.
 *
 * No `upgrade-insecure-requests` (it would break plain-http localhost testing) and no HSTS here:
 * Vercel already sends Strict-Transport-Security on the live hosts.
 */
const contentSecurityPolicy = ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");

// Nothing in the app uses these browser capabilities, so deny them for this page and any embedded content.
const permissionsPolicy = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "serial",
  "hid",
  "bluetooth",
  "midi",
  "display-capture",
  "accelerometer",
  "gyroscope",
  "magnetometer",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Legacy equivalent of frame-ancestors for browsers that predate CSP2.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Private app: never send our URLs to other sites (e.g. when following a lead's website link).
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
];

// The application used to live at the site root. These keep old bookmarks and already-sent
// password-reset links working (query strings are passed through). Temporary (307) on purpose:
// browsers cache permanent redirects, so a mistake could not be taken back.
const movedSections = "login|signup|forgot-password|reset-password|pending|auth|dashboard|tasks|notes|journal|finance|goals|habits|time|crm|admin|settings";

// The recovery page holds a one-time token, so it may load from and send to this site only, and it
// sends no referrer. 'unsafe-inline' is needed for Next's own bootstrap scripts (see above): the
// point here is to shut out other origins. React's development build also needs eval.
// (Later entries override the same header from the general list.)
const recoveryHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      contentSecurityPolicy,
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  // Server action arguments are never written to the console (they can hold a recovery token).
  logging: { serverFunctions: false },
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async redirects() {
    return [{ source: `/:section(${movedSections})/:path*`, destination: "/app/:section/:path*", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/app/auth/recovery", headers: recoveryHeaders },
    ];
  },
};

export default nextConfig;
