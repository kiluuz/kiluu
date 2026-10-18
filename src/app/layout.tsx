import type { Metadata, Viewport } from "next";
import {
  Geist, Geist_Mono, Space_Grotesk,
  Unbounded, Shippori_Mincho, Fraunces, Cormorant_Garamond,
  Playfair_Display, Noto_Serif_SC, Amiri, PT_Serif,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { QueryProvider } from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/* ============ DUBANIX BRAND FONTS ============ */
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "800"],
});

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["500", "600"],
});

/* ============ WELCOME LOADER FONTS (per-language, exact reference set) ============ */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: "300",
  style: ["normal", "italic"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: "500",
  style: "italic",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: "500",
  style: "italic",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: "300",
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: "400",
  style: "italic",
});

const ptSerif = PT_Serif({
  variable: "--font-ptserif",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "DubAniX — Stream, Collect & Exchange Anime",
  description:
    "Premium anime streaming universe. Watch free and exclusive animes, collect credits, trade with collectors, and host synced watch parties with friends. Voice it your way.",
  keywords: ["anime", "streaming", "watch together", "anime exchange", "DubAniX", "anime dubbing"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "DubAniX",
    siteName: "DubAniX",
    description: "Stream, collect and exchange premium anime. Voice it your way.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, type: "image/png" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DubAniX",
    description: "Stream, collect and exchange premium anime. Voice it your way.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12100d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${unbounded.variable} ${shipporiMincho.variable} ${fraunces.variable} ${cormorantGaramond.variable} ${playfairDisplay.variable} ${notoSerifSC.variable} ${amiri.variable} ${ptSerif.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <QueryProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
