import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage, Prose, ProseH2, ProseUl, ProseLi } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

const POSTS = [
  {
    slug: "role-based-access-control-explained",
    title: "Role-based access control, explained without the jargon",
    date: "August 20, 2026",
    category: "Guides",
    excerpt:
      "Owner, Admin, Member, Viewer what those roles actually allow, and why enforcement has to happen server-side, not just in the UI.",
    body: (
      <>
        <p>
          <LiveText>Access control sounds like the most boring feature a product team can talk about until
          the day someone deletes a production project. Then it&apos;s the most important one.</LiveText>
        </p>

        <p>
          <LiveText>FlexFlow uses four roles per workspace:</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Owner</LiveText>
          </strong>{" "}
          <LiveText>(full control, billing and workspace deletion),</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Admin</LiveText>
          </strong>{" "}
          <LiveText>(manage team and workspace
          settings),</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Member</LiveText>
          </strong>{" "}
          <LiveText>(day-to-day work),
          and</LiveText>{" "}
          <strong className="text-(--text-primary)">
            <LiveText>Viewer</LiveText>
          </strong>{" "}
          <LiveText>(read-only).</LiveText>
        </p>

        <ProseH2><LiveText>Enforcement is the difference</LiveText></ProseH2>
        <p>
          <LiveText>A permission matrix rendered in settings is not access control. The real test is whether
          the API also rejects the call. In FlexFlow every workspace-scoped route checks your
          membership and role before it touches a row, so hiding a button never has to be the thing
          protecting your data.</LiveText>
        </p>

        <ProseH2><LiveText>A model that scales</LiveText></ProseH2>
        <p>
          <LiveText>You can apply the same four mental models at most organizations:</LiveText>
        </p>
        <ProseUl>
          <ProseLi><LiveText>Owner the accountable person.</LiveText></ProseLi>
          <ProseLi><LiveText>Admin the operational manager.</LiveText></ProseLi>
          <ProseLi><LiveText>Member everyone building.</LiveText></ProseLi>
          <ProseLi><LiveText>Viewer stakeholders who watch.</LiveText></ProseLi>
        </ProseUl>

        <p>
          <LiveText>Add one role to a new hire when they join, and you never spend a Friday afternoon walking
          someone through every repo, project, and setting. Read the full role matrix in the</LiveText>{" "}
          <Link href="/docs" className="font-medium text-brand-500 hover:text-brand-400">
            <LiveText>documentation</LiveText>
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
          <LiveText>A task marked &quot;done&quot; is a claim, not a fact. Somewhere between the claim and reality is
          where most project tools lose the plot statuses drift, QA happens in a Slack thread,
          and nobody can answer &quot;did this actually ship?&quot;</LiveText>
        </p>

        <p>
          <LiveText>FlexFlow&apos;s review workflow keeps the loop in the task: an assignee finishes the work and
          submits it for review. The assigner approves it to Done, or sends it back with requested
          changes, and a notification lands in both inboxes either way.</LiveText>
        </p>

        <ProseH2><LiveText>Why it feels good</LiveText></ProseH2>
        <ProseUl>
          <ProseLi><LiveText>The context lives with the task, not across three tools.</LiveText></ProseLi>
          <ProseLi><LiveText>Every state change is recorded in the activity log.</LiveText></ProseLi>
          <ProseLi><LiveText>Reviewers make a single, conscious decision approve or bounce.</LiveText></ProseLi>
        </ProseUl>

        <p>
          <LiveText>It&apos;s a small change with an outsized effect: boards stop being decoration and start being
          an honest mirror of where work actually is.</LiveText>
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
          <LiveText>Most kanban boards fail for the same reason most resumes fail: they&apos;re about looking
          right, not being right. If a board only updates when someone remembers to drag a card, it
          is a to-do list with extra steps.</LiveText>
        </p>

        <p>
          <LiveText>Three rules keep our boards honest:</LiveText>
        </p>
        <ProseUl>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>Small cards.</LiveText>
            </strong>{" "}
            <LiveText>If a task can&apos;t fit into
            two short lines, it&apos;s an epic wearing a trench coat.</LiveText>
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>One owner.</LiveText>
            </strong>{" "}
            <LiveText>Unassigned cards get
            ignored. Assign work or archive it.</LiveText>
          </ProseLi>
          <ProseLi>
            <strong className="text-(--text-primary)">
              <LiveText>Review before done.</LiveText>
            </strong>{" "}
            <LiveText>Done means
            reviewed and approved, not &quot;no one&apos;s looked at it yet.&quot;</LiveText>
          </ProseLi>
        </ProseUl>

        <p>
          <LiveText>When the board is a mirror of reality, realtime collaboration stops being a gimmick
          the moment a card moves, everyone sees why.</LiveText>
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
    <ContentPage
      eyebrow={<LiveText>{`${post.category} · ${post.date}`}</LiveText>}
      title={<LiveText>{post.title}</LiveText>}
      narrow={true}
    >
      <Prose>{post.body}</Prose>
      <Link href="/blog" className="mt-10 inline-block text-sm font-medium text-brand-500 hover:text-brand-400">
        <LiveText>← Back to all posts</LiveText>
      </Link>
    </ContentPage>
  );
}