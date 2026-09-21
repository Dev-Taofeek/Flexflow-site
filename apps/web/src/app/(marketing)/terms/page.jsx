import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of the FlexFlow service.",
};

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Legal</LiveText>}
      title={<LiveText>Terms of Service</LiveText>}
      description={
        <LiveText>Last updated: June 2026. By using FlexFlow you agree to these terms. Read them carefully.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>1. The service</LiveText></ProseH2>
        <p>
          <LiveText>FlexFlow provides a hosted project management application (the “Service”). These terms
          govern your access to and use of the Service, regardless of the device or client you use.</LiveText>
        </p>

        <ProseH2><LiveText>2. Accounts</LiveText></ProseH2>
        <p>
          <LiveText>You&apos;re responsible for maintaining the confidentiality of your credentials and for
          all activity under your account. Enable two-factor authentication to help keep your
          account secure. Notify us promptly at</LiveText>{" "}
          <a href="mailto:obayomitaofeek7@gmail.com" className="font-medium text-brand-500 hover:text-brand-400">
            support@flexflow.app
          </a>{" "}
          <LiveText>if you believe your account has been compromised.</LiveText>
        </p>

        <ProseH2><LiveText>3. Acceptable use</LiveText></ProseH2>
        <p>
          <LiveText>You may not use the Service to: violate any law or regulation; infringe the rights of
          others; distribute malware; attempt to gain unauthorized access to the Service, other
          users&apos; data, or our systems; or interfere with the Service&apos;s operation or
          security.</LiveText>
        </p>

        <ProseH2><LiveText>4. Your content</LiveText></ProseH2>
        <p>
          <LiveText>You retain ownership of the content you post to the Service. You grant us a limited
          license to store, process, and display that content solely to operate the Service.
          Deleting content from the Service permanently removes it from our systems.</LiveText>
        </p>

        <ProseH2><LiveText>5. Subscriptions and billing</LiveText></ProseH2>
        <p>
          <LiveText>Paid plans are billed on the cadence shown at sign-up. You can upgrade, downgrade, or
          cancel at any time from your settings; cancellation takes effect at the end of the
          current billing period and you&apos;ll retain access until then.</LiveText>
        </p>

        <ProseH2><LiveText>6. Availability</LiveText></ProseH2>
        <p>
          <LiveText>We work hard to keep the Service reliable, but we don&apos;t guarantee uninterrupted
          availability. “Live” status information is published on the</LiveText>{" "}
          <Link href="/status" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>status page</LiveText>
          </Link>
          .
        </p>

        <ProseH2><LiveText>7. Liability</LiveText></ProseH2>
        <p>
          <LiveText>To the maximum extent permitted by law, the Service is provided “as is” without
          warranties of any kind, and our total liability for any claim arising out of or relating
          to these terms is limited to the amount you paid for the Service in the twelve months
          before the claim.</LiveText>
        </p>

        <ProseH2><LiveText>8. Termination</LiveText></ProseH2>
        <p>
          <LiveText>You may stop using the Service at any time. We may suspend or terminate access for
          violations of these terms, prolonged non-payment, or conduct that poses a risk to the
          Service or other users.</LiveText>
        </p>

        <ProseH2><LiveText>9. Changes</LiveText></ProseH2>
        <p>
          <LiveText>We may update these terms from time to time. Material changes will be announced in
          advance, and continued use of the Service after changes take effect constitutes
          acceptance.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}