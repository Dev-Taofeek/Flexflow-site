import Link from "next/link";
import { Wordmark } from "@/components/marketing/MarketingHeader";

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
          <div lang="en">
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-(--text-tertiary)">
              A project management workspace for teams that plan, assign, track, and ship together.
            </p>
            <p className="mt-4 text-sm text-(--text-tertiary)">
              Reach us at{" "}
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
              <FooterLinkGroup key={column.headingKey} column={column} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-(--border) pt-8 sm:flex-row">
          <p className="text-sm text-(--text-tertiary)">
            © {new Date().getFullYear()} FlexFlow. All rights reserved.
          </p>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 text-xs font-medium text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
          >
            <span className="flex h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
            All systems operational
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ column }) {
  const heading = FOOTER_HEADING_KEYS[column.headingKey] || column.headingKey;
  return (
    <div lang="en">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
        {heading}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {column.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
            >
              {FOOTER_LINK_KEYS[link.labelKey] || link.labelKey}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// English fallbacks (footer is intentionally plain-language for all locales).
const FOOTER_HEADING_KEYS = {
  "nav.product": "Product",
  "nav.company": "Company",
  "nav.resources": "Resources",
  "nav.legal": "Legal",
};

const FOOTER_LINK_KEYS = {
  "nav.features": "Features",
  "nav.intelligence": "Intelligence",
  "nav.pricing": "Pricing",
  "nav.changelog": "Changelog",
  "nav.roadmap": "Roadmap",
  "nav.status": "Status",
  "nav.about": "About",
  "nav.blog": "Blog",
  "nav.careers": "Careers",
  "nav.contact": "Contact",
  "nav.documentation": "Documentation",
  "nav.helpCenter": "Help center",
  "nav.security": "Security",
  "nav.privacy": "Privacy",
  "nav.terms": "Terms",
  "nav.cookies": "Cookies",
  "nav.dpa": "DPA",
};