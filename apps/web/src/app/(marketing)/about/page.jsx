import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "About",
  description:
    "FlexFlow is a project management workspace for teams that plan, assign, track, and ship together.",
};

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>About</LiveText>}
      title={<LiveText>A project workspace built for teams that ship.</LiveText>}
      description={
        <LiveText>FlexFlow started with a simple observation: most project tools either fight you with complexity or hide real functionality behind an endless treadmill of integrations.</LiveText>
      }
    >
      <Prose>
        <p>
          <LiveText>We believe a team&apos;s tooling should get out of the way. That means one place to plan
          projects, assign tasks, review completed work, control who can do what, and measure how
          the team is actually pacing without a dozen duct-taped integrations or a spreadsheet
          that&apos;s already out of date.</LiveText>
        </p>

        <ProseH2><LiveText>What we value</LiveText></ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Honesty over hype.</LiveText>
            </strong>{" "}
            <LiveText>Features are real,
            documented, and enforceable server-side. If a permission exists, it&apos;s enforced.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Clarity over clutter.</LiveText>
            </strong>{" "}
            <LiveText>Boards, roles,
            and analytics you can understand at a glance no training course required.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Speed by default.</LiveText>
            </strong>{" "}
            <LiveText>Real-time updates,
            responsive design, and an interface that stays fast on every device.</LiveText>
          </li>
        </ul>

        <ProseH2><LiveText>Today and next</LiveText></ProseH2>
        <p>
          <LiveText>FlexFlow ships in public. Follow the</LiveText>{" "}
          <Link href="/changelog" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>changelog</LiveText>
          </Link>{" "}
          <LiveText>for what landed, and the</LiveText>{" "}
          <Link href="/roadmap" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>roadmap</LiveText>
          </Link>{" "}
          <LiveText>for where we&apos;re heading.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}