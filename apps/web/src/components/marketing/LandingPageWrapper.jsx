"use client";

import dynamic from "next/dynamic";

const LandingPageClient = dynamic(
  () => import("@/components/marketing/LandingPageClient").then((mod) => mod.LandingPageClient),
  { ssr: false }
);

export function LandingPageWrapper() {
  return <LandingPageClient />;
}
