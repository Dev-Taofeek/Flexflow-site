import Link from "next/link";
import { ContentPage, Prose, ProseH2, ProseCode } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

export const metadata = {
  title: "Documentation",
  description:
    "Learn how to set up FlexFlow: workspaces, projects, tasks, roles, and review workflows.",
};

export default function DocsPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Documentation</LiveText>}
      title={<LiveText>Get up and running.</LiveText>}
      description={
        <LiveText>The guide covers the essentials: setting up an organization, building a board, assigning roles, and shipping work through review.</LiveText>
      }
    >
      <Prose>
        <ProseH2><LiveText>1. Create your organization</LiveText></ProseH2>
        <p>
          <LiveText>Sign up and create your organization. The first person to create an organization becomes
          its</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Owner</LiveText>
          </strong>{" "}
          <LiveText>. You can then create one or
          more workspaces each workspace has its own projects, board, team, and permission roles.</LiveText>
        </p>

        <ProseH2><LiveText>2. Invite your team</LiveText></ProseH2>
        <p>
          <LiveText>From</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Settings → Team</LiveText>
          </strong>
          <LiveText>, invite members
          by email. Owners and Admins can assign a role at invite time:</LiveText>
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Owner</LiveText>
            </strong>{" "}
            <LiveText>full control, including
            deleting the workspace and managing roles.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Admin</LiveText>
            </strong>{" "}
            <LiveText>manage members, invites, and
            workspace settings.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Member</LiveText>
            </strong>{" "}
            <LiveText>create and update projects,
            tasks, and comments.</LiveText>
          </li>
          <li>
            <strong className="text-(--text-primary)">
              <LiveText>Viewer</LiveText>
            </strong>{" "}
            <LiveText>read-only access.</LiveText>
          </li>
        </ul>
        <p>
          <LiveText>Roles are enforced server-side on every API call, so permissions hold even if a member
          builds a request by hand.</LiveText>
        </p>

        <ProseH2><LiveText>3. Create a project and board</LiveText></ProseH2>
        <p>
          <LiveText>Projects group related work. Open a project to see its kanban board with four columns:
          To Do, In Progress, In Review, and Done. Create a task by clicking</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Add task</LiveText>
          </strong>{" "}
          <LiveText>on any column, give it a
          title, assign an owner, and add labels or a due date.</LiveText>
        </p>

        <ProseH2><LiveText>4. Use the review workflow</LiveText></ProseH2>
        <p>
          <LiveText>When work is finished, the assignee moves it to</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>In Review</LiveText>
          </strong>{" "}
          <LiveText>and submits it. The person
          who assigned the task gets a notification, reviews it, and either approves it to Done or
          bounces it back with requested changes. Every step is recorded in the activity log.</LiveText>
        </p>

        <ProseH2><LiveText>5. Track progress</LiveText></ProseH2>
        <p>
          <LiveText>The dashboard summarizes recent activity and task counts. Open</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Analytics</LiveText>
          </strong>{" "}
          <LiveText>for velocity, workload,
          burndown, and cycle time charts that update in real time.</LiveText>
        </p>

        <ProseH2><LiveText>Security best practices</LiveText></ProseH2>
        <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">
          <li>
            <LiveText>Enable two-factor authentication in</LiveText>{" "}
            <strong className="text-(--text-primary)">
              <LiveText>Settings → Profile</LiveText>
            </strong>
            .
          </li>
          <li>
            <LiveText>Use the strongest role you need, no more: Viewer where read-only is enough.</LiveText>
          </li>
          <li>
            <LiveText>Keep invite links and role assignments current when people leave your team.</LiveText>
          </li>
        </ul>

        <p>
          <LiveText>API reference and endpoints live in the open-source repository. The web client talks to a
          REST API mounted at</LiveText>{" "}
          <ProseCode>/api</ProseCode>
          <LiveText>, with realtime events over Socket.io.</LiveText>
        </p>
      </Prose>
    </ContentPage>
  );
}