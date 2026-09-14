import Link from "next/link";
import { ContentPage } from "@/components/marketing/ContentPage";

const ROLES = [
  {
    title: "Senior Full-Stack Engineer",
    team: "Platform",
    location: "Remote — worldwide",
    description:
      "Build and scale FlexFlow's realtime core: the Express API, Prisma data model, and WebSocket layer.",
  },
  {
    title: "Product Engineer",
    team: "Web",
    location: "Remote — worldwide",
    description:
      "Own end-to-end product work across the Next.js app: boards, settings, permissions, and analytics.",
  },
  {
    title: "Technical Writer",
    team: "Docs",
    location: "Remote — worldwide",
    description:
      "Turn the FlexFlow product into clear documentation, guides, and changelog entries.",
  },
];

export const metadata = {
  title: "Careers",
  description:
    "Join FlexFlow. We're a small, remote team building a project workspace for teams that ship.",
};

export default function CareersPage() {
  return (
    <ContentPage
      eyebrow="Careers"
      title="Build tools your team will thank you for."
      description="We're a small, fully remote team obsessed with honest product: real features, documented, enforced server-side, and pleasant to use."
    >
      <div className="space-y-4">
        {ROLES.map((role) => (
          <div
            key={role.title}
            className="rounded-2xl border border-(--border) p-6 transition-colors hover:border-(--border-strong)"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-(--text-primary)">{role.title}</h3>
                <p className="mt-1 text-sm text-(--text-tertiary)">
                  {role.team} · {role.location}
                </p>
              </div>
              <Link
                href="/contact"
                className="rounded-lg border border-(--border) px-3.5 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary)"
              >
                Apply
              </Link>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-(--text-secondary)">
              {role.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-(--border) p-6 text-sm leading-relaxed text-(--text-secondary)">
        Don&apos;t see a role that fits? We&apos;re always glad to hear from talented people — write
        to us via the <Link href="/contact" className="font-medium text-brand-500 hover:text-brand-400">contact page</Link>.
      </div>
    </ContentPage>
  );
}