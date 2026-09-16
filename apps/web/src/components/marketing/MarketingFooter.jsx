import Link from "next/link";
import { Wordmark } from "@/components/marketing/MarketingHeader";
import { LiveText } from "@/components/LiveText";
import { FooterLinkColumn } from "@/components/marketing/FooterLinkColumn";

const CONTACT_EMAIL = "flexflow@gmail.com";

const FOOTER_COLUMN_KEYS = [
  {
    headingKey: "nav.product",
    links: [
      { labelKey: "nav.features", href: "/#features" },
      { labelKey: "nav.intelligence", href: "/#intelligence" },
      { labelKey: "nav.pricing", href: "/pricing" },
      { labelKey: "nav.changelog", href: "/changelog" },
      { labelKey: "nav.roadmap", href: "/roadmap" },
      { labelKey: "nav.status", href: "/status" },
    ],
  },
  {
    headingKey: "nav.company",
    links: [
      { labelKey: "nav.about", href: "/about" },
      { labelKey: "nav.blog", href: "/blog" },
      { labelKey: "nav.careers", href: "/careers" },
      { labelKey: "nav.contact", href: "/contact" },
    ],
  },
  {
    headingKey: "nav.resources",
    links: [
      { labelKey: "nav.documentation", href: "/docs" },
      { labelKey: "nav.helpCenter", href: "/help" },
      { labelKey: "nav.security", href: "/security" },
    ],
  },
  {
    headingKey: "nav.legal",
    links: [
      { labelKey: "nav.privacy", href: "/privacy" },
      { labelKey: "nav.terms", href: "/terms" },
      { labelKey: "nav.cookies", href: "/cookies" },
      { labelKey: "nav.dpa", href: "/dpa" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-(--border) bg-(--bg-elevated)">
      <div className="mx-auto w-full max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-(--text-tertiary)">
              <LiveText>A project management workspace for teams that plan, assign, track, and ship together.</LiveText>
            </p>
            <p className="mt-4 text-sm text-(--text-tertiary)">
              <LiveText>Reach us at</LiveText>{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-brand-500 transition-colors hover:text-brand-400"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <div className="mt-6 flex items-center gap-5">
              {[
                { label: "GitHub", href: "https://github.com/Dev-Taofeek/Flexflow-site" },
                { label: "X (Twitter)", href: "https://x.com/flexflow" },
                { label: "LinkedIn", href: "https://www.linkedin.com/company/flexflow" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-xs font-medium text-(--text-tertiary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary)"
                  aria-label={`FlexFlow on ${social.label}`}
                >
                  {social.label === "GitHub"
                    ? "Gf"
                    : social.label === "LinkedIn"
                      ? "in"
                      : social.label === "X (Twitter)"
                        ? "X"
                        : social.label}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLUMN_KEYS.map((column) => (
              <FooterLinkColumn key={column.headingKey} column={column} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-(--border) pt-8 sm:flex-row">
          <p className="text-sm text-(--text-tertiary)">
            © {new Date().getFullYear()} FlexFlow. <LiveText>All rights reserved.</LiveText>
          </p>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 text-xs font-medium text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
          >
            <span className="flex h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
            <LiveText>All systems operational</LiveText>
          </Link>
        </div>
      </div>
    </footer>
  );
}
