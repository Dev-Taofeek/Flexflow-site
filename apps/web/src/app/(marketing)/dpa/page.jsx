import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Data Processing Addendum",
  description:
    "The data processing addendum describing how FlexFlow processes personal data on behalf of customers.",
};

export default function DpaPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Data Processing Addendum"
      description="Last updated: June 2026. This DPA forms part of our Terms of Service where you act as a controller and FlexFlow processes customer data on your behalf."
    >
      <Prose>
        <ProseH2>1. Roles</ProseH2>
        <p>
          You are the controller of the personal data you upload to the Service; FlexFlow processes
          that data on your behalf as a processor. Each of us will comply with applicable data
          protection law.
        </p>

        <ProseH2>2. What we process</ProseH2>
        <p>
          We process personal data in workspace content (such as names and emails of your members)
          solely to provide the Service, in accordance with your instructions and the{" "}
          <Link href="/privacy" className="font-medium text-brand-500 hover:text-brand-400">
            Privacy Policy
          </Link>
          .
        </p>

        <ProseH2>3. Security</ProseH2>
        <p>
          We apply technical and organizational measures to protect personal data, including
          encryption in transit and at rest, access controls, and the measures described on our{" "}
          <Link href="/security" className="font-medium text-brand-500 hover:text-brand-400">
            security page
          </Link>
          .
        </p>

        <ProseH2>4. Sub-processors</ProseH2>
        <p>
          We may engage sub-processors (for example hosting and infrastructure providers) to deliver
          the Service. Where we do, they&apos;re bound by data protection obligations no less
          protective than this DPA.
        </p>

        <ProseH2>5. Data subject rights and assistance</ProseH2>
        <p>
          To the extent required by law, we&apos;ll help you respond to requests from data subjects
          exercising their rights (access, rectification, erasure, restriction, portability).
          You can reach us at{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>
          .
        </p>

        <ProseH2>6. International transfers</ProseH2>
        <p>
          Personal data may be transferred to and processed in other countries where FlexFlow or its
          sub-processors operate, using appropriate safeguards as required by law.
        </p>
      </Prose>
    </ContentPage>
  );
}