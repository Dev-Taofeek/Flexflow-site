import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Security",
  description:
    "How FlexFlow protects your data: encryption, authentication, authorization, and responsible disclosure.",
};

export default function SecurityPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Security</LiveText>}
      title={<LiveText>Security is a feature, enforced everywhere.</LiveText>}
      description={
        <LiveText>A summary of the controls we run: how data is protected in transit and at rest, how access is authenticated and authorized, and how we handle disclosures.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>Data in transit and at rest</LiveText></ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li><LiveText>All traffic is served over HTTPS with TLS 1.2+.</LiveText></li>
          <li><LiveText>Passwords are hashed with bcrypt (cost factor 12) and never stored in plain text.</LiveText></li>
          <li><LiveText>Secrets, refresh tokens, and two-factor secrets are stored encrypted and are never returned by the API.</LiveText></li>
          <li><LiveText>Database access is isolated to the API service over an encrypted connection.</LiveText></li>
        </ul>

        <ProseH2><LiveText>Authentication and two-factor</LiveText></ProseH2>
        <p>
          <LiveText>Sessions use short-lived access tokens plus rotating refresh tokens. Two-factor
          authentication (TOTP) is available to every account from Settings → Profile, and is
          honored at sign-in whenever it&apos;s enabled.</LiveText>
        </p>

        <ProseH2><LiveText>Authorization</LiveText></ProseH2>
        <p>
          <LiveText>Workspace roles — Owner, Admin, Member, Viewer; are enforced server-side on every
          workspace-scoped route through a central permission matrix. Hiding a button in the UI is
          never the line of defense; the API refuses unauthorized calls directly.</LiveText>
        </p>

        <ProseH2><LiveText>Application hardening</LiveText></ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li><LiveText>Rate limiting is applied to authentication endpoints to slow brute-force attempts.</LiveText></li>
          <li><LiveText>Internal endpoints require a shared internal secret and are never exposed publicly.</LiveText></li>
          <li><LiveText>Dependencies are pinned and reviewed on every release.</LiveText></li>
        </ul>

        <ProseH2><LiveText>Responsible disclosure</LiveText></ProseH2>
        <p>
          <LiveText>Found a vulnerability? Report it privately to</LiveText>{" "}
          <a href="mailto:obayomitaofeek7@gmail.com" className="font-medium text-brand-500 hover:text-brand-400">
            security@flexflow.app
          </a>
          <LiveText>. Please don&apos;t publicly disclose until we&apos;ve had a chance to respond we reply
          quickly, treat reports confidentially, and credit reporters who follow responsible
          disclosure.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}