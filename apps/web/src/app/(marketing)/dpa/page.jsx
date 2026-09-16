import Link from "next/link";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Data Processing Addendum",
  description:
    "The data processing addendum describing how FlexFlow processes personal data on behalf of customers.",
};

export default function DpaPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Legal</LiveText>}
      title={<LiveText>Data Processing Addendum</LiveText>}
      description={
        <LiveText>Last updated: June 2026. This DPA forms part of our Terms of Service where you act as a controller and FlexFlow processes customer data on your behalf.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>1. Roles</LiveText></ProseH2>
        <p>
          <LiveText>You are the controller of the personal data you upload to the Service; FlexFlow processes
          that data on your behalf as a processor. Each of us will comply with applicable data
          protection law.</LiveText>
        </p>

        <ProseH2><LiveText>2. What we process</LiveText></ProseH2>
        <p>
          <LiveText>We process personal data in workspace content (such as names and emails of your members)
          solely to provide the Service, in accordance with your instructions and the</LiveText>{" "}
          <Link href="/privacy" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>Privacy Policy</LiveText>
          </Link>
          .
        </p>

        <ProseH2><LiveText>3. Security</LiveText></ProseH2>
        <p>
          <LiveText>We apply technical and organizational measures to protect personal data, including
          encryption in transit and at rest, access controls, and the measures described on our</LiveText>{" "}
          <Link href="/security" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>security page</LiveText>
          </Link>
          .
        </p>

        <ProseH2><LiveText>4. Sub-processors</LiveText></ProseH2>
        <p>
          <LiveText>We may engage sub-processors (for example hosting and infrastructure providers) to deliver
          the Service. Where we do, they&apos;re bound by data protection obligations no less
          protective than this DPA.</LiveText>
        </p>

        <ProseH2><LiveText>5. Data subject rights and assistance</LiveText></ProseH2>
        <p>
          <LiveText>To the extent required by law, we&apos;ll help you respond to requests from data subjects
          exercising their rights (access, rectification, erasure, restriction, portability).
          You can reach us at</LiveText>{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>
          .
        </p>

        <ProseH2><LiveText>6. International transfers</LiveText></ProseH2>
        <p>
          <LiveText>Personal data may be transferred to and processed in other countries where FlexFlow or its
          sub-processors operate, using appropriate safeguards as required by law.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}