import { ContactForm } from "@/components/marketing/ContactForm";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the FlexFlow team sales, support, partnerships, or just to say hello.",
};

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Contact</LiveText>}
      title={<LiveText>Talk to a human.</LiveText>}
      description={
        <LiveText>Sales, support, partnerships, feedback all the same inbox. We usually reply within one business day.</LiveText>
      }
    >
      <ContactForm />

      <div className="mt-10">
        <Prose>
          <ProseH2><LiveText>Other ways to reach us</LiveText></ProseH2>
          <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
            <li>
              <strong className="text-(--text-primary)">
                <LiveText>Support</LiveText>
              </strong>{" "}
              <LiveText> live product help in
              the</LiveText>{" "}
              <a href="/help" className="font-medium text-brand-500 hover:text-brand-400">
                <LiveText>help center</LiveText>
              </a>
              <LiveText>, or email</LiveText>{" "}
              <a href="mailto:support@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
                support@flexflow.app
              </a>
              .
            </li>
            <li>
              <strong className="text-(--text-primary)">
                <LiveText>Security</LiveText>
              </strong>{" "}
              <LiveText> report vulnerabilities
              privately via our</LiveText>{" "}
              <a href="/security" className="font-medium text-brand-500 hover:text-brand-400">
                <LiveText>security page</LiveText>
              </a>
              .
            </li>
            <li>
              <strong className="text-(--text-primary)">
                <LiveText>Enterprise</LiveText>
              </strong>{" "}
              <LiveText> talk through custom
              roles, SSO, and audit requirements by emailing</LiveText>{" "}
              <a href="mailto:enterprise@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
                enterprise@flexflow.app
              </a>
              .
            </li>
          </ul>
        </Prose>
      </div>
    </ContentPage>
  );
}