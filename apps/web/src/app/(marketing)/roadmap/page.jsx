import { ContentPage } from "@/components/marketing/ContentPage";

const ROADMAP = [
  {
    title: "Shipped",
    tone: "bg-success-500",
    items: [
      "Organizations, workspaces, and projects",
      "Kanban boards with review workflows",
      "Role-based access control (RBAC)",
      "Team analytics",
      "Real-time collaboration",
      "Custom task labels per workspace",
      "2-factor authentication",
    ],
  },
  {
    title: "In progress",
    tone: "bg-brand-500",
    items: [
      "Open API reference",
    ],
  },
  {
    title: "Planned",
    tone: "bg-warning-500",
    items: [
      "Slack notifications via incoming webhooks",
      "Custom kanban columns and statuses",
      "Single sign-on (SSO) / SAML",
      "Audit log export",
      "Task dependencies",
      "Mobile apps (iOS and Android)",
    ],
  },
];

export const metadata = {
  title: "Roadmap",
  description:
    "What FlexFlow is building next — shipped, in progress, and planned. Feedback shapes the roadmap.",
};

export default function RoadmapPage() {
  return (
    <ContentPage
      eyebrow="Roadmap"
      title="What we're building next."
      description="A public view of what's shipped, what's in progress, and what's planned. Have an idea or a vote to cast? Contact us — customer feedback drives the roadmap."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {ROADMAP.map((column) => (
          <div key={column.title} className="rounded-2xl border border-(--border) p-6">
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${column.tone}`} aria-hidden="true" />
              <h3 className="text-base font-semibold text-(--text-primary)">{column.title}</h3>
            </div>
            <ul className="mt-5 space-y-3">
              {column.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--text-tertiary)"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-(--text-secondary)">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}