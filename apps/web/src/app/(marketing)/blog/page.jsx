import Link from "next/link";
import { ContentPage } from "@/components/marketing/ContentPage";

const POSTS = [
  {
    slug: "role-based-access-control-explained",
    title: "Role-based access control, explained without the jargon",
    excerpt:
      "Owner, Admin, Member, Viewer — what those roles actually allow, and why enforcement has to happen server-side, not just in the UI.",
    date: "August 20, 2026",
    category: "Guides",
  },
  {
    slug: "why-review-workflows-keep-your-qa-human",
    title: "Why review workflows keep quality reviews human",
    excerpt:
      "Move from \"done, trust me\" to a lightweight submit-and-approve loop that keeps context in the task instead of in Slack threads.",
    date: "August 4, 2026",
    category: "Product",
  },
  {
    slug: "kanban-for-teams-that-hate-busywork",
    title: "Kanban for teams that hate busywork",
    excerpt:
      "A board is only useful if it doesn't become a second job. Here's how we keep ours a mirror of reality rather than a to-do list with extra steps.",
    date: "July 15, 2026",
    category: "Product",
  },
];

export const metadata = {
  title: "Blog",
  description: "Thoughts on project management, permissions, and building software with a team.",
};

export default function BlogIndexPage() {
  return (
    <ContentPage
      eyebrow="Blog"
      title="Notes on building and shipping as a team."
      description="Guides and product stories from the FlexFlow team."
    >
      <div className="space-y-4">
        {POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-(--border) p-6 transition-colors hover:border-(--border-strong)"
          >
            <div className="flex items-center gap-3 text-xs text-(--text-tertiary)">
              <span className="rounded-full border border-(--border) px-2.5 py-0.5 font-medium text-(--text-secondary)">
                {post.category}
              </span>
              <span>{post.date}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-(--text-primary) transition-colors group-hover:text-brand-500">
              {post.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </ContentPage>
  );
}