import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Privacy Policy",
  description: "How FlexFlow collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Privacy</LiveText>}
      title={<LiveText>Privacy Policy</LiveText>}
      description={
        <LiveText>Last updated: June 2026. This policy explains what we collect, why we collect it, and the control you have over your data.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>What we collect</LiveText></ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Account data</LiveText>
            </strong>{" "}
            <LiveText>name, email, and
            password (hashed) you provide when registering.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Workspace data</LiveText>
            </strong>{" "}
            <LiveText>the organizations,
            workspaces, projects, tasks, labels, invitations, and comments you create.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Usage data</LiveText>
            </strong>{" "}
            <LiveText>anonymous technical
            data like browser type and performance metrics that helps us keep the service reliable.</LiveText>
          </li>
        </ul>

        <ProseH2><LiveText>How we use it</LiveText></ProseH2>
        <p>
          <LiveText>We use your data to provide the service (auth, collaboration, permissions, notifications),
          to keep it secure, and to improve it. We do not sell personal data, and we don&apos;t use
          your workspace content for advertising.</LiveText>
        </p>

        <ProseH2><LiveText>How long we keep it</LiveText></ProseH2>
        <p>
          <LiveText>Your workspace stays available while your account is active. You can delete tasks,
          projects, and workspaces yourself from within the app. Account data is retained only as
          long as needed for the service and our legal obligations.</LiveText>
        </p>

        <ProseH2><LiveText>Your rights</LiveText></ProseH2>
        <p>
          <LiveText>Subject to applicable law, you can request access to, correction of, or deletion of your
          personal data, and you can object to or restrict certain processing. Contact us at</LiveText>{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>{" "}
          <LiveText>to exercise these rights.</LiveText>
        </p>

        <ProseH2><LiveText>Cookies and local storage</LiveText></ProseH2>
        <p>
          <LiveText>We use cookies and local storage only for authentication and security (session tokens,
          preferences). We don&apos;t use third-party advertising cookies.</LiveText>
        </p>

        <ProseH2><LiveText>Changes to this policy</LiveText></ProseH2>
        <p>
          <LiveText>If we change this policy materially, we&apos;ll update the date above and notify you by
          email or in-product where required.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}