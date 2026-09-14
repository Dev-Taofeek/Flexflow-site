import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Privacy Policy",
  description: "How FlexFlow collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="Last updated: June 2026. This policy explains what we collect, why we collect it, and the control you have over your data."
    >
      <Prose>
        <ProseH2>What we collect</ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">Account data</strong> — name, email, and
            password (hashed) you provide when registering.
          </li>
          <li>
            <strong className="text-(--text-primary)">Workspace data</strong> — the organizations,
            workspaces, projects, tasks, labels, invitations, and comments you create.
          </li>
          <li>
            <strong className="text-(--text-primary)">Usage data</strong> — anonymous technical
            data like browser type and performance metrics that helps us keep the service reliable.
          </li>
        </ul>

        <ProseH2>How we use it</ProseH2>
        <p>
          We use your data to provide the service (auth, collaboration, permissions, notifications),
          to keep it secure, and to improve it. We do not sell personal data, and we don&apos;t use
          your workspace content for advertising.
        </p>

        <ProseH2>How long we keep it</ProseH2>
        <p>
          Your workspace stays available while your account is active. You can delete tasks,
          projects, and workspaces yourself from within the app. Account data is retained only as
          long as needed for the service and our legal obligations.
        </p>

        <ProseH2>Your rights</ProseH2>
        <p>
          Subject to applicable law, you can request access to, correction of, or deletion of your
          personal data, and you can object to or restrict certain processing. Contact us at{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>{" "}
          to exercise these rights.
        </p>

        <ProseH2>Cookies and local storage</ProseH2>
        <p>
          We use cookies and local storage only for authentication and security (session tokens,
          preferences). We don&apos;t use third-party advertising cookies.
        </p>

        <ProseH2>Changes to this policy</ProseH2>
        <p>
          If we change this policy materially, we&apos;ll update the date above and notify you by
          email or in-product where required.
        </p>
      </Prose>
    </ContentPage>
  );
}