import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SITE, SITE_URL } from "@/lib/site";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const condensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE.name} — COMP90050 Group 40`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  authors: [
    { name: "Sunchuangyu Huang" },
    { name: "Runqiu Fei" },
    { name: "Xiaoyi Liu" },
    { name: "Qingxuan Yang" },
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — COMP90050 Group 40`,
    description: SITE.description,
    locale: "en_AU",
  },
  keywords: [
    "self-driving database",
    "index selection",
    "multi-armed bandit",
    "AutoAdmin",
    "CoPhy",
    "QB5000",
    "SQLite",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1222" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      suppressHydrationWarning
      className={`${sans.variable} ${condensed.variable} ${mono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
