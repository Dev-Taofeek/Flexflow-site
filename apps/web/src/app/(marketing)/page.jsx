import { LandingPageWrapper } from "@/components/marketing/LandingPageWrapper";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "FlexFlow — RBAC and Team Collaboration for Modern SaaS Teams",
  description:
    "FlexFlow is a polished SaaS platform for project management, RBAC, team collaboration, Kanban workflows, issue tracking, and analytics.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FlexFlow — RBAC and Team Collaboration",
    description:
      "Plan projects, manage permissions, collaborate with your team, and track delivery analytics in one modern workspace.",
    url: "/",
    siteName: "FlexFlow",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FlexFlow product dashboard preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlexFlow — RBAC and Team Collaboration",
    description:
      "A production-grade SaaS platform for teams that need projects, issues, RBAC, analytics, and real-time collaboration.",
    images: ["/opengraph-image"],
  },
};

export default function MarketingHomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FlexFlow",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "FlexFlow is a role-based access control and team collaboration platform for project management, issue tracking, Kanban workflows, and analytics.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Role-based access control",
      "Project management",
      "Issue tracking",
      "Kanban board",
      "Team collaboration",
      "Analytics dashboard",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageWrapper />
    </>
  );
}
