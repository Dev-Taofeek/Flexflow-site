import { ContentPage, Prose, ProseH2, ProseUl, ProseLi } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Cookie Policy",
  description: "How FlexFlow uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Cookie Policy"
      description="Last updated: June 2026. This policy explains what cookies we use, why, and the choices you have — including the appearance settings that are stored locally on your device."
    >
      <Prose>
        <ProseH2>What cookies we use</ProseH2>
        <ProseUl>
          <ProseLi>
            <strong className="text-(--text-primary)">Session cookies</strong> — keep you signed in
            across requests. Without them, authentication and file uploads can&apos;t work.
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">CSRF tokens</strong> — a security measure that
            protects submitted forms from cross-site request forgery.
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">Next-auth session cache</strong> — a signed
            session token used by our authentication flow.
          </ProseLi>
        </ProseUl>
        <p>
          We do not use advertising cookies, and we do not sell browsing data to third parties.
        </p>

        <ProseH2>Preferences stored on your device</ProseH2>
        <p>
          When you use our appearance settings (theme and font size), your choices are saved in your
          browser&apos;s local storage under the key <code className="font-mono">flexflow:preferences</code>.
          This is not a cookie, but it works the same way — it lets the app restore your preferred
          theme and text size on your next visit, including a &quot;system&quot; theme that follows
          your operating system setting.
        </p>
        <p>
          No preference data is transmitted to our servers.
        </p>

        <ProseH2>Managing cookies</ProseH2>
        <p>
          You can clear session cookies and local storage at any time from your browser&apos;s
          settings. Signing out clears the session cookie; clearing site data will also reset your
          appearance preferences back to the system default.
        </p>

        <ProseH2>Changes and contact</ProseH2>
        <p>
          If we change how we use cookies, we&apos;ll update this page. Questions about cookies or
          your data? Email{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>{" "}
          or read our{" "}
          <a href="/privacy" className="font-medium text-brand-500 hover:text-brand-400">
            Privacy Policy
          </a>
          .
        </p>
      </Prose>
    </ContentPage>
  );
}