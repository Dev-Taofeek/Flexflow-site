import { LiveText } from "@/components/LiveText";
import { ContentPage, Prose, ProseH2 } from "@/components/marketing/ContentPage";

const RELEASES = [
  {
    version: "v1.3.0",
    date: "September 2026",
    heading: "Task review workflows",
    entries: [
      "Assignees can now submit completed tasks for review directly from the board.",
      "Reviewers approve a task (moving it to Done) or send it back with requested changes.",
      "Notifications are sent to the assigner and assignee at every review step.",
    ],
    tag: "Shipped",
  },
  {
    version: "v1.2.0",
    date: "August 2026",
    heading: "Team analytics",
    entries: [
      "New analytics dashboard with velocity, workload, burndown, and cycle time charts.",
      "Charts update in real time as tasks move across the board.",
      "Activity logs and task history are searchable from the dashboard.",
    ],
    tag: "Shipped",
  },
  {
    version: "v1.1.0",
    date: "July 2026",
    heading: "Role-based access control",
    entries: [
      "Owner, Admin, Member, and Viewer roles with granular permissions per workspace.",
      "Permissions are enforced server-side on every route, not just hidden in the UI.",
      "Invites let owners assign a role before a new member even signs up.",
    ],
    tag: "Shipped",
  },
  {
    version: "v1.0.0",
    date: "June 2026",
    heading: "FlexFlow 1.0",
    entries: [
      "Organizations, workspaces, projects, and kanban boards.",
      "Realtime collaboration over Socket.io.",
      "Two-factor authentication, password reset, and push notification infrastructure.",
      "Responsive app shell with mobile bottom navigation.",
    ],
    tag: "Shipped",
  },
];

export const metadata = {
  title: "Changelog",
  description: "Product updates and improvements shipped to FlexFlow, release by release.",
};

export default function ChangelogPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Changelog</LiveText>}
      title={<LiveText>Product updates, release by release.</LiveText>}
      description={
        <LiveText>Every improvement to FlexFlow, documented. Track our roadmap on the roadmap page.</LiveText>
      }
    >
      <Prose>
        {RELEASES.map((release) => (
          <div key={release.version}>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-semibold text-(--text-primary)">
                {release.version}
              </span>
              <span className="text-sm text-(--text-tertiary)">
                <LiveText>{release.date}</LiveText>
              </span>
            </div>
            <ProseH2>
              <LiveText>{release.heading}</LiveText>
            </ProseH2>
            <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
              {release.entries.map((entry) => (
                <li key={entry}>
                  <LiveText>{entry}</LiveText>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-success-500">
              <LiveText>{release.tag}</LiveText>
            </p>
          </div>
        ))}
      </Prose>
    </ContentPage>
  );
}