import Link from "next/link";
import { ContentPage } from "@/components/marketing/ContentPage";

const HELP_ITEMS = [
  {
    title: "I forgot my password",
    body: "Click “Forgot password?” on the sign-in page. We'll email you a secure reset link that expires shortly after being sent.",
  },
  {
    title: "Enable two-factor authentication",
    body: "Go to Settings → Profile → Two-factor authentication. Scan the QR code with your authenticator app, confirm the current code, and keep your backup codes somewhere safe.",
  },
  {
    title: "Invite a new team member",
    body: "Open Settings → Team and choose Invite. Pick their role (Owner, Admin, Member, Viewer) before sending so they start with the right permissions.",
  },
  {
    title: "Submit a task for review",
    body: "On the board, move the task to In Review and confirm the submission. The assigner receives a notification and can approve the task to Done or send it back with changes.",
  },
  {
    title: "I can't see a project",
    body: "Roles are enforced per workspace. If you can't see or edit something, ask an Owner or Admin to check the role you've been assigned.",
  },
  {
    title: "Change my role or organization",
    body: "Role changes are made by Owners and Admins from Settings → Team. To manage organizations (including creating a new one), use the organization switcher in the sidebar.",
  },
  {
    title: "Still stuck?",
    body: null,
  },
];

export const metadata = {
  title: "Help center",
  description: "Answers to common questions about using FlexFlow.",
};

export default function HelpPage() {
  return (
    <ContentPage
      eyebrow="Help center"
      title="How can we help?"
      description="Quick answers to the questions we hear most."
      narrow={true}
    >
      <div className="space-y-3">
        {HELP_ITEMS.slice(0, -1).map((item) => (
          <div key={item.title} className="rounded-2xl border border-(--border) p-6">
            <h3 className="text-base font-semibold text-(--text-primary)">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-(--border) p-6">
        <h3 className="text-base font-semibold text-(--text-primary)">Still stuck?</h3>
        <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
          Read the <Link href="/docs" className="font-medium text-brand-500 hover:text-brand-400">documentation</Link>, or{" "}
          <Link href="/contact" className="font-medium text-brand-500 hover:text-brand-400">contact support</Link>{" "}
          and we&apos;ll help you out.
        </p>
      </div>
    </ContentPage>
  );
}