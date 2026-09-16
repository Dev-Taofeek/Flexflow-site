import Link from "next/link";
import { ContentPage, Prose, ProseH2, ProseCode } from "@/components/marketing/ContentPage";

export const metadata = {
  title: "Documentation",
  description:
    "Learn how to set up FlexFlow: workspaces, projects, tasks, roles, and review workflows.",
};

export default function DocsPage() {
  return (
    <ContentPage
      eyebrow="Documentation"
      title="Get up and running."
      description="The guide covers the essentials: setting up an organization, building a board, assigning roles, and shipping work through review."
    >
      <Prose>
        <ProseH2>1. Create your organization</ProseH2>
        <p>
          Sign up and create your organization. The first person to create an organization becomes
          its <strong className="text-(--text-primary)">Owner</strong>. You can then create one or
          more workspaces — each workspace has its own projects, board, team, and permission roles.
        </p>

        <ProseH2>2. Invite your team</ProseH2>
        <p>
          From <strong className="text-(--text-primary)">Settings → Team</strong>, invite members
          by email. Owners and Admins can assign a role at invite time:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">Owner</strong> — full control, including
            deleting the workspace and managing roles.
          </li>
          <li>
            <strong className="text-(--text-primary)">Admin</strong> — manage members, invites, and
            workspace settings.
          </li>
          <li>
            <strong className="text-(--text-primary)">Member</strong> — create and update projects,
            tasks, and comments.
          </li>
          <li>
            <strong className="text-(--text-primary)">Viewer</strong> — read-only access.
          </li>
        </ul>
        <p>
          Roles are enforced server-side on every API call, so permissions hold even if a member
          builds a request by hand.
        </p>

        <ProseH2>3. Create a project and board</ProseH2>
        <p>
          Projects group related work. Open a project to see its kanban board with four columns:
          To Do, In Progress, In Review, and Done. Create a task by clicking{" "}
          <strong className="text-(--text-primary)">Add task</strong> on any column, give it a
          title, assign an owner, and add labels or a due date.
        </p>

        <ProseH2>4. Use the review workflow</ProseH2>
        <p>
          When work is finished, the assignee moves it to{" "}
          <strong className="text-(--text-primary)">In Review</strong> and submits it. The person
          who assigned the task gets a notification, reviews it, and either approves it to Done or
          bounces it back with requested changes. Every step is recorded in the activity log.
        </p>

        <ProseH2>5. Track progress</ProseH2>
        <p>
          The dashboard summarizes recent activity and task counts. Open{" "}
          <strong className="text-(--text-primary)">Analytics</strong> for velocity, workload,
          burndown, and cycle time charts that update in real time.
        </p>

        <ProseH2>Security best practices</ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            Enable two-factor authentication in{" "}
            <strong className="text-(--text-primary)">Settings → Profile</strong>.
          </li>
          <li>
            Use the strongest role you need, no more: Viewer where read-only is enough.
          </li>
          <li>
            Keep invite links and role assignments current when people leave your team.
          </li>
        </ul>

        <p>
          API reference and endpoints live in the open-source repository. The web client talks to a
          REST API mounted at <ProseCode>/api</ProseCode>, with realtime events over Socket.io.
        </p>
      </Prose>
    </ContentPage>
  );
}