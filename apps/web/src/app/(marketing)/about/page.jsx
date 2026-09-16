import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "About",
  description:
    "FlexFlow is a project management workspace for teams that plan, assign, track, and ship together.",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="A project workspace built for teams that ship."
      description="FlexFlow started with a simple observation: most project tools either fight you with complexity or hide real functionality behind an endless treadmill of integrations."
    >
      <Prose>
        <p>
          We believe a team&apos;s tooling should get out of the way. That means one place to plan
          projects, assign tasks, review completed work, control who can do what, and measure how
          the team is actually pacing — without a dozen duct-taped integrations or a spreadsheet
          that&apos;s already out of date.
        </p>

        <ProseH2>What we value</ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">Honesty over hype.</strong> Features are real,
            documented, and enforceable server-side. If a permission exists, it&apos;s enforced.
          </li>
          <li>
            <strong className="text-(--text-primary)">Clarity over clutter.</strong> Boards, roles,
            and analytics you can understand at a glance — no training course required.
          </li>
          <li>
            <strong className="text-(--text-primary)">Speed by default.</strong> Real-time updates,
            responsive design, and an interface that stays fast on every device.
          </li>
        </ul>

        <ProseH2>Today and next</ProseH2>
        <p>
          FlexFlow ships in public. Follow the{" "}
          <Link href="/changelog" className="font-medium text-brand-500 hover:text-brand-400">
            changelog
          </Link>{" "}
          for what landed, and the{" "}
          <Link href="/roadmap" className="font-medium text-brand-500 hover:text-brand-400">
            roadmap
          </Link>{" "}
          for where we&apos;re heading.
        </p>
      </Prose>
    </ContentPage>
  );
}