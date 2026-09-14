import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage, Prose, ProseH2, ProseUl, ProseLi } from "@/components/marketing/ContentPage";

const POSTS = [
  {
    slug: "role-based-access-control-explained",
    title: "Role-based access control, explained without the jargon",
    date: "August 20, 2026",
    category: "Guides",
    excerpt:
      "Owner, Admin, Member, Viewer — what those roles actually allow, and why enforcement has to happen server-side, not just in the UI.",
    body: (
      <>
        <p>
          Access control sounds like the most boring feature a product team can talk about — until
          the day someone deletes a production project. Then it&apos;s the most important one.
        </p>

        <p>
          FlexFlow uses four roles per workspace: <strong className="text-(--text-primary)">Owner</strong>{" "}
          (full control, billing and workspace deletion),{" "}
          <strong className="text-(--text-primary)">Admin</strong> (manage team and workspace
          settings), <strong className="text-(--text-primary)">Member</strong> (day-to-day work),
          and <strong className="text-(--text-primary)">Viewer</strong> (read-only).
        </p>

        <ProseH2>Enforcement is the difference</ProseH2>
        <p>
          A permission matrix rendered in settings is not access control. The real test is whether
          the API also rejects the call. In FlexFlow every workspace-scoped route checks your
          membership and role before it touches a row, so hiding a button never has to be the thing
          protecting your data.
        </p>

        <ProseH2>A model that scales</ProseH2>
        <p>You can apply the same four mental models at most organizations:</p>
        <ProseUl>
          <ProseLi>Owner — the accountable person.</ProseLi>
          <ProseLi>Admin — the operational manager.</ProseLi>
          <ProseLi>Member — everyone building.</ProseLi>
          <ProseLi>Viewer — stakeholders who watch.</ProseLi>
        </ProseUl>

        <p>
          Add one role to a new hire when they join, and you never spend a Friday afternoon walking
          someone through every repo, project, and setting. Read the full role matrix in the{" "}
          <Link href="/docs" className="font-medium text-brand-500 hover:text-brand-400">
            documentation
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    slug: "why-review-workflows-keep-your-qa-human",
    title: "Why review workflows keep quality reviews human",
    date: "August 4, 2026",
    category: "Product",
    excerpt:
      "Move from \"done, trust me\" to a lightweight submit-and-approve loop that keeps context in the task instead of in Slack threads.",
    body: (
      <>
        <p>
          A task marked &quot;done&quot; is a claim, not a fact. Somewhere between the claim and reality is
          where most project tools lose the plot — statuses drift, QA happens in a Slack thread,
          and nobody can answer &quot;did this actually ship?&quot;
        </p>

        <p>
          FlexFlow&apos;s review workflow keeps the loop in the task: an assignee finishes the work and
          submits it for review. The assigner approves it to Done, or sends it back with requested
          changes, and a notification lands in both inboxes either way.
        </p>

        <ProseH2>Why it feels good</ProseH2>
        <ProseUl>
          <ProseLi>The context lives with the task, not across three tools.</ProseLi>
          <ProseLi>Every state change is recorded in the activity log.</ProseLi>
          <ProseLi>Reviewers make a single, conscious decision — approve or bounce.</ProseLi>
        </ProseUl>

        <p>
          It&apos;s a small change with an outsized effect: boards stop being decoration and start being
          an honest mirror of where work actually is.
        </p>
      </>
    ),
  },
  {
    slug: "kanban-for-teams-that-hate-busywork",
    title: "Kanban for teams that hate busywork",
    date: "July 15, 2026",
    category: "Product",
    excerpt:
      "A board is only useful if it doesn't become a second job. Here's how we keep ours a mirror of reality rather than a to-do list with extra steps.",
    body: (
      <>
        <p>
          Most kanban boards fail for the same reason most resumes fail: they&apos;re about looking
          right, not being right. If a board only updates when someone remembers to drag a card, it
          is a to-do list with extra steps.
        </p>

        <p>
          Three rules keep our boards honest:
        </p>
        <ProseUl>
          <ProseLi>
            <strong className="text-(--text-primary)">Small cards.</strong> If a task can&apos;t fit into
            two short lines, it&apos;s an epic wearing a trench coat.
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">One owner.</strong> Unassigned cards get
            ignored. Assign work or archive it.
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">Review before done.</strong> Done means
            reviewed and approved, not &quot;no one&apos;s looked at it yet.&quot;
          </ProseLi>
        </ProseUl>

        <p>
          When the board is a mirror of reality, realtime collaboration stops being a gimmick —
          the moment a card moves, everyone sees why.
        </p>
      </>
    ),
  },
];

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default function BlogPostPage({ params }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  return (
    <ContentPage eyebrow={`${post.category} · ${post.date}`} title={post.title} narrow={true}>
      <Prose>{post.body}</Prose>
      <Link href="/blog" className="mt-10 inline-block text-sm font-medium text-brand-500 hover:text-brand-400">
        ← Back to all posts
      </Link>
    </ContentPage>
  );
}