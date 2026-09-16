import { ContentPage, Prose, ProseH2, ProseUl, ProseLi } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Cookie Policy",
  description: "How FlexFlow uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Legal</LiveText>}
      title={<LiveText>Cookie Policy</LiveText>}
      description={
        <LiveText>Last updated: June 2026. This policy explains what cookies we use, why, and the choices you have including the appearance settings that are stored locally on your device.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>What cookies we use</LiveText></ProseH2>
        <ProseUl>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>Session cookies</LiveText>
            </strong>{" "}
            <LiveText>keep you signed in
            across requests. Without them, authentication and file uploads can&apos;t work.</LiveText>
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>CSRF tokens</LiveText>
            </strong>{" "}
            <LiveText>a security measure that
            protects submitted forms from cross-site request forgery.</LiveText>
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>Next-auth session cache</LiveText>
            </strong>{" "}
            <LiveText>a signed
            session token used by our authentication flow.</LiveText>
          </ProseLi>
        </ProseUl>
        <p>
          <LiveText>We do not use advertising cookies, and we do not sell browsing data to third parties.</LiveText>
        </p>

        <ProseH2><LiveText>Preferences stored on your device</LiveText></ProseH2>
        <p>
          <LiveText>When you use our appearance settings (theme and font size), your choices are saved in your
          browser&apos;s local storage under the key</LiveText>{" "}
          <code className="font-mono">flexflow:preferences</code>
          <LiveText>. This is not a cookie, but it works the same way it lets the app restore your preferred
          theme and text size on your next visit, including a &quot;system&quot; theme that follows
          your operating system setting.</LiveText>
        </p>
        <p>
          <LiveText>No preference data is transmitted to our servers.</LiveText>
        </p>

        <ProseH2><LiveText>Managing cookies</LiveText></ProseH2>
        <p>
          <LiveText>You can clear session cookies and local storage at any time from your browser&apos;s
          settings. Signing out clears the session cookie; clearing site data will also reset your
          appearance preferences back to the system default.</LiveText>
        </p>

        <ProseH2><LiveText>Changes and contact</LiveText></ProseH2>
        <p>
          <LiveText>If we change how we use cookies, we&apos;ll update this page. Questions about cookies or
          your data? Email</LiveText>{" "}
          <a href="mailto:privacy@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            privacy@flexflow.app
          </a>{" "}
          <LiveText>or read our</LiveText>{" "}
          <a href="/privacy" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>Privacy Policy</LiveText>
          </a>
          .
        </p>
      </Prose>
    </ContentPage>
  );
}