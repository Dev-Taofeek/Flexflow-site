import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of the FlexFlow service.",
};

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of Service"
      description="Last updated: June 2026. By using FlexFlow you agree to these terms. Read them carefully."
    >
      <Prose>
        <ProseH2>1. The service</ProseH2>
        <p>
          FlexFlow provides a hosted project management application (the “Service”). These terms
          govern your access to and use of the Service, regardless of the device or client you use.
        </p>

        <ProseH2>2. Accounts</ProseH2>
        <p>
          You&apos;re responsible for maintaining the confidentiality of your credentials and for
          all activity under your account. Enable two-factor authentication to help keep your
          account secure. Notify us promptly at{" "}
          <a href="mailto:support@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            support@flexflow.app
          </a>{" "}
          if you believe your account has been compromised.
        </p>

        <ProseH2>3. Acceptable use</ProseH2>
        <p>
          You may not use the Service to: violate any law or regulation; infringe the rights of
          others; distribute malware; attempt to gain unauthorized access to the Service, other
          users&apos; data, or our systems; or interfere with the Service&apos;s operation or
          security.
        </p>

        <ProseH2>4. Your content</ProseH2>
        <p>
          You retain ownership of the content you post to the Service. You grant us a limited
          license to store, process, and display that content solely to operate the Service.
          Deleting content from the Service permanently removes it from our systems.
        </p>

        <ProseH2>5. Subscriptions and billing</ProseH2>
        <p>
          Paid plans are billed on the cadence shown at sign-up. You can upgrade, downgrade, or
          cancel at any time from your settings; cancellation takes effect at the end of the
          current billing period and you&apos;ll retain access until then.
        </p>

        <ProseH2>6. Availability</ProseH2>
        <p>
          We work hard to keep the Service reliable, but we don&apos;t guarantee uninterrupted
          availability. “Live” status information is published on the{" "}
          <Link href="/status" className="font-medium text-brand-500 hover:text-brand-400">
            status page
          </Link>
          .
        </p>

        <ProseH2>7. Liability</ProseH2>
        <p>
          To the maximum extent permitted by law, the Service is provided “as is” without
          warranties of any kind, and our total liability for any claim arising out of or relating
          to these terms is limited to the amount you paid for the Service in the twelve months
          before the claim.
        </p>

        <ProseH2>8. Termination</ProseH2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for
          violations of these terms, prolonged non-payment, or conduct that poses a risk to the
          Service or other users.
        </p>

        <ProseH2>9. Changes</ProseH2>
        <p>
          We may update these terms from time to time. Material changes will be announced in
          advance, and continued use of the Service after changes take effect constitutes
          acceptance.
        </p>
      </Prose>
    </ContentPage>
  );
}