import type { Metadata } from "next";
import { Mona_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeScript } from "@/components/layout/theme-script";
import "./globals.css";

const monaSans = Mona_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AMHIL OS",
  description: "Personal command center for tasks, habits, goals, time, and finance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${monaSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
