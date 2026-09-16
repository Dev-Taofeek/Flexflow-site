import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Security",
  description:
    "How FlexFlow protects your data: encryption, authentication, authorization, and responsible disclosure.",
};

export default function SecurityPage() {
  return (
    <ContentPage
      eyebrow="Security"
      title="Security is a feature, enforced everywhere."
      description="A summary of the controls we run: how data is protected in transit and at rest, how access is authenticated and authorized, and how we handle disclosures."
    >
      <Prose>
        <ProseH2>Data in transit and at rest</ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>All traffic is served over HTTPS with TLS 1.2+.</li>
          <li>Passwords are hashed with bcrypt (cost factor 12) and never stored in plain text.</li>
          <li>Secrets, refresh tokens, and two-factor secrets are stored encrypted and are never returned by the API.</li>
          <li>Database access is isolated to the API service over an encrypted connection.</li>
        </ul>

        <ProseH2>Authentication and two-factor</ProseH2>
        <p>
          Sessions use short-lived access tokens plus rotating refresh tokens. Two-factor
          authentication (TOTP) is available to every account from Settings → Profile, and is
          honored at sign-in whenever it&apos;s enabled.
        </p>

        <ProseH2>Authorization</ProseH2>
        <p>
          Workspace roles — Owner, Admin, Member, Viewer — are enforced server-side on every
          workspace-scoped route through a central permission matrix. Hiding a button in the UI is
          never the line of defense; the API refuses unauthorized calls directly.
        </p>

        <ProseH2>Application hardening</ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>Rate limiting is applied to authentication endpoints to slow brute-force attempts.</li>
          <li>Internal endpoints require a shared internal secret and are never exposed publicly.</li>
          <li>Dependencies are pinned and reviewed on every release.</li>
        </ul>

        <ProseH2>Responsible disclosure</ProseH2>
        <p>
          Found a vulnerability? Report it privately to{" "}
          <a href="mailto:security@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            security@flexflow.app
          </a>
          . Please don&apos;t publicly disclose until we&apos;ve had a chance to respond — we reply
          quickly, treat reports confidentially, and credit reporters who follow responsible
          disclosure.
        </p>
      </Prose>
    </ContentPage>
  );
}