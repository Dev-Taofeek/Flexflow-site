import { ContactForm } from "@/components/marketing/ContactForm";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the FlexFlow team — sales, support, partnerships, or just to say hello.",
};

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Contact"
      title="Talk to a human."
      description="Sales, support, partnerships, feedback — all the same inbox. We usually reply within one business day."
    >
      <ContactForm />

      <div className="mt-10">
        <Prose>
          <ProseH2>Other ways to reach us</ProseH2>
          <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
            <li>
              <strong className="text-(--text-primary)">Support</strong> — live product help in
              the{" "}
              <a href="/help" className="font-medium text-brand-500 hover:text-brand-400">
                help center
              </a>
              , or email{" "}
              <a href="mailto:support@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
                support@flexflow.app
              </a>
              .
            </li>
            <li>
              <strong className="text-(--text-primary)">Security</strong> — report vulnerabilities
              privately via our{" "}
              <a href="/security" className="font-medium text-brand-500 hover:text-brand-400">
                security page
              </a>
              .
            </li>
            <li>
              <strong className="text-(--text-primary)">Enterprise</strong> — talk through custom
              roles, SSO, and audit requirements by emailing{" "}
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