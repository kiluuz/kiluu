import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Kiluu — Your Anime Universe",
  description:
    "Stream free and exclusive anime, collect credits, gift series to friends, and host synced watch parties with Kiluu.",
};

export default async function Page() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("kiluu-locale")?.value;
  const initialLocale = isLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE;

  return <LandingPage initialLocale={initialLocale} />;
}
