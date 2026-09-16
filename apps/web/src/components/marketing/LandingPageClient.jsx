"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PLANS, FEATURES, getFeatureInfo } from "@flexflow/plans";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

function createIcon(paths) {
  return function Icon({ className, strokeWidth = 2, ...rest }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

const ArrowRight = createIcon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);
const BarChart3 = createIcon(
  <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </>,
);
const Check = createIcon(<path d="M20 6 9 17l-5-5" />);
const CheckCircle = createIcon(
  <>
    <path d="M21.801 10A10 10 0 1 1 17 3.335" />
    <path d="m9 11 3 3L22 4" />
  </>,
);
const ChevronDown = createIcon(<path d="m6 9 6 6 6-6" />);
const GitPullRequest = createIcon(
  <>
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" x2="6" y1="9" y2="21" />
  </>,
);
const LayoutGrid = createIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>,
);
const LockKeyhole = createIcon(
  <>
    <circle cx="12" cy="16" r="1" />
    <rect x="3" y="10" width="18" height="12" rx="2" />
    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
  </>,
);
const Lock = createIcon(
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
const Search = createIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </>,
);
const ShieldCheck = createIcon(
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
const Sparkles = createIcon(
  <>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
  </>,
);
const Users = createIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);
const Zap = createIcon(
  <>
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </>,
);
const Plug = createIcon(
  <>
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </>,
);
const BookOpen = createIcon(
  <>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </>,
);

import { Button } from "@/components/ui/Button";
import { ContactForm } from "@/components/marketing/ContactForm";

const features = [
  {
    title: "Role-based access control",
    description:
      "Owner, Admin, Member, and Viewer roles with a permission matrix you can read at a glance. Fine-grained control per workspace, project, and task.",
    icon: ShieldCheck,
  },
  {
    title: "Kanban boards",
    description:
      "Drag work across To Do, In Progress, In Review, and Done on a board that stays in sync for every teammate.",
    icon: LayoutGrid,
  },
  {
    title: "Review workflows",
    description:
      "Assignees submit completed work for review. The assigner approves it as done or sends it back with requested changes straight from the task.",
    icon: GitPullRequest,
  },
  {
    title: "Live collaboration",
    description:
      "Socket-powered real-time updates keep boards, tasks, and notifications current the moment anything changes.",
    icon: Users,
  },
  {
    title: "Team analytics",
    description:
      "Velocity, workload, burndown, and cycle time rendered as readable charts no spreadsheet wrangling.",
    icon: BarChart3,
  },
  {
    title: "Fast search",
    description:
      "Find any task or project across your workspace in milliseconds, filtered to what you can actually see.",
    icon: Search,
  },
];

const steps = [
  {
    title: "Create your workspace",
    description:
      "Set up your organization, create a workspace, and assign roles to teammates in minutes.",
  },
  {
    title: "Plan and assign",
    description:
      "Create projects, define tasks, add labels, set deadlines, and assign work to the right people.",
  },
  {
    title: "Track and ship",
    description:
      "Move work across the board, review completed tasks, and keep the whole team aligned on progress.",
  },
];

const intelligenceQuestions = [
  {
    question: "Why did we choose this architecture?",
    answer: "Your platform team recorded the call: TypeScript everywhere, strict mode, on the event pipeline to cut integration bugs.",
    source: "Decision memory · Platform workspace",
  },
  {
    question: "Which projects are currently blocked?",
    answer: "Payments API was flagged blocked on a security review. Checkout flow has 3 open bugs in review.",
    source: "Tasks · Insights workspace",
  },
  {
    question: "Who owns the mobile app initiative?",
    answer: "Priya owns the mobile initiative. Six tasks are assigned to her across Sprint 12.",
    source: "Tasks · Product workspace",
  },
];

const integrations = [
  { name: "Slack", detail: "Post task updates and decision summaries to channels.", icon: Zap },
  { name: "GitHub", detail: "Link pull requests to tasks and review workflows.", icon: GitPullRequest },
  { name: "Webhooks", detail: "Push anything to your own tools, or receive events in.", icon: Plug },
  { name: "REST API", detail: "Full read/write API with scoped tokens and usage limits.", icon: ArrowRight },
];

const securityPoints = [
  "Encryption in transit and at rest",
  "Role-based permissions enforced on the server",
  "Workspace and organization isolation",
  "Organization 2FA on Pro",
  "SSO / SAML on Custom",
  "Advanced audit logs on Custom",
];

const faqs = [
  {
    question: "What can FlexFlow do out of the box?",
    answer:
      "Projects, tasks, kanban boards, team management, role-based permissions, review workflows, notifications, activity logs, analytics, and Team Intelligence all in one workspace.",
  },
  {
    question: "How do roles and permissions work?",
    answer:
      "Every member is assigned a role (Owner, Admin, Member, or Viewer). Permissions are enforced on both the UI and the API, so sensitive actions are gated server-side. Pro and Custom plans unlock customizable permission matrices.",
  },
  {
    question: "What is Team Intelligence?",
    answer:
      "It turns your team's scattered work tasks, projects, comments, activity, and decision memory into a searchable, citable knowledge base. Ask questions in plain English and get answers with sources you're actually allowed to see.",
  },
  {
    question: "Is collaboration real-time?",
    answer:
      "Yes. Task and board updates are pushed over Socket.io, so changes show up for your team the moment they happen.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Anytime. Upgrade to Pro or Custom for immediate entitlements, or cancel and keep paid access until the end of your billing window.",
  },
];

function KanbanPreview() {
  const columns = [
    { name: "To Do", tone: "bg-neutral-500", cards: ["Design tokens", "Public docs"] },
    { name: "In Progress", tone: "bg-brand-500", cards: ["Rate limiting"] },
    { name: "In Review", tone: "bg-warning-500", cards: ["RBAC matrix"], highlight: true },
    { name: "Done", tone: "bg-success-500", cards: ["Auth setup", "Seed script"] },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {columns.map((col) => (
        <div
          key={col.name}
          className={[
            "rounded-xl border p-2.5",
            col.highlight
              ? "border-brand-500/50 bg-brand-500/10"
              : "border-(--border) bg-(--bg-overlay)",
          ].join(" ")}
        >
          <div className="flex items-center gap-1.5 pb-2">
            <span className={`h-1.5 w-1.5 rounded-full ${col.tone}`} />
            <span className="text-[11px] font-semibold text-(--text-secondary)"><Translated>{col.name}</Translated></span>
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card) => (
              <div
                key={card}
                className="rounded-lg border border-(--border) bg-(--bg-elevated) px-2 py-1.5 text-[11px] font-medium text-(--text-secondary)"
              >
                <Translated>{card}</Translated>
              </div>
            ))}
            {col.cards.length === 0 ? (
              <div className="flex h-8 items-center justify-center rounded-lg border border-dashed border-(--border)">
                <span className="text-[10px] text-(--text-tertiary)"><Translated>Empty</Translated></span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const PREVIEW_NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "intelligence", label: "Intelligence" },
];

const PREVIEW_PROJECTS = [
  { name: "Website relaunch", color: "#6366f1", done: 12, total: 16, updated: "2h ago" },
  { name: "Mobile app", color: "#22c55e", done: 8, total: 21, updated: "yesterday" },
  { name: "Onboarding flows", color: "#f59e0b", done: 3, total: 9, updated: "3d ago" },
  { name: "Design system", color: "#ec4899", done: 5, total: 5, updated: "5d ago" },
];

const PREVIEW_TEAM = [
  { name: "Priya Sharma", initials: "PS", role: "Owner", you: false },
  { name: "Marcus Webb", initials: "MW", role: "Admin", you: false },
  { name: "Aisha Khan", initials: "AK", role: "Member", you: false },
  { name: "Tomas Rivera", initials: "TR", role: "Member", you: false },
  { name: "You", initials: "YO", role: "Owner", you: true },
];

function Avatar({ initials }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--border) bg-(--bg-overlay) text-[10px] font-semibold text-(--text-secondary)">
      {initials}
    </span>
  );
}

function PreviewProjects() {
  return (
    <div className="space-y-2.5">
      {PREVIEW_PROJECTS.map((p, i) => {
        const pct = Math.round((p.done / p.total) * 100);
        return (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
            className="rounded-xl border border-(--border) bg-(--bg-overlay) p-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-xs font-semibold text-(--text-primary)"><Translated>{p.name}</Translated></span>
              <span className="text-[11px] text-(--text-tertiary)">
                <Translated>{p.done}/{p.total} tasks</Translated>
              </span>
              <span className="ml-auto text-[11px] text-(--text-tertiary)"><Translated>{p.updated}</Translated></span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--bg-overlay)">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                className="block h-full rounded-full"
                style={{ background: p.color }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function PreviewTeam() {
  return (
    <div className="space-y-1.5">
      {PREVIEW_TEAM.map((m, i) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
          className="flex items-center gap-3 rounded-xl border border-(--border) bg-(--bg-overlay) px-3 py-2.5"
        >
          <Avatar initials={m.initials} />
          <span className="text-xs font-medium text-(--text-primary)">
            {m.name}
            {m.you ? <span className="text-(--text-tertiary)"><Translated>(that&apos;s you)</Translated></span> : null}
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
              m.you
                ? "bg-brand-500/10 text-brand-500"
                : "bg-(--bg-overlay) text-(--text-tertiary)",
            ].join(" ")}
          >
            <Translated>{m.role}</Translated>
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function PreviewIntelligence() {
  return (
    <div className="space-y-2.5">
      {intelligenceQuestions.slice(0, 2).map((item, i) => (
        <motion.div
          key={item.question}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3, ease: "easeOut" }}
          className="rounded-xl border border-(--border) bg-(--bg-overlay) p-3.5"
        >
          <p className="flex items-start gap-2 text-xs font-semibold text-(--text-primary)">
            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={1.7} />
            <Translated>{item.question}</Translated>
          </p>
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-(--bg) p-2.5 text-[11px] leading-relaxed text-(--text-secondary)">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={1.7} />
            <Translated>{item.answer}</Translated>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-(--text-tertiary)">
            <BookOpen className="h-3 w-3" strokeWidth={1.7} />
            <Translated>{item.source}</Translated>
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function PreviewBoard() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-(--text-primary)"><Translated>Product · Sprint 12</Translated></p>
          <p className="text-xs text-(--text-tertiary)"><Translated>Drag tasks across columns, in real time</Translated></p>
        </div>
        <span className="rounded-full bg-(--bg-overlay) px-2 py-0.5 text-[11px] font-medium text-(--text-tertiary)">
          <Translated>Live sync</Translated>
        </span>
      </div>
      <KanbanPreview />
    </>
  );
}

function PreviewDashboard() {
  return (
    <>
      <div>
        <p className="text-sm font-semibold text-(--text-primary)"><Translated>Design System</Translated></p>
        <p className="text-xs text-(--text-tertiary)"><Translated>5 tasks pending review</Translated></p>
      </div>
      <KanbanPreview />
    </>
  );
}

function AppPreview() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="overflow-hidden rounded-2xl border border-(--border) bg-(--bg-elevated) p-2 shadow-2xl">
      <div className="overflow-hidden rounded-xl border border-(--border)">
        <div className="flex items-center gap-2 border-b border-(--border) px-4 py-3">
          <LockKeyhole className="h-3.5 w-3.5 text-(--text-tertiary)" strokeWidth={1.7} />
          <span className="text-xs font-medium text-(--text-tertiary)"><Translated>Flexflow Design System</Translated></span>
          <span className="ml-auto rounded-md bg-(--bg-overlay) px-2 py-0.5 text-[11px] font-medium text-(--text-tertiary)">
            <Translated>Live preview</Translated>
          </span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
          <aside className="hidden flex-col gap-1 lg:flex">
            {PREVIEW_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === item.id
                    ? "border border-(--border) bg-(--bg-overlay) text-(--text-primary)"
                    : "text-(--text-tertiary) hover:text-(--text-secondary)",
                ].join(" ")}
              >
                <Translated>{item.label}</Translated>
              </button>
            ))}
          </aside>

          <div className="min-w-0 space-y-4">
            <div
              className="grid grid-cols-5 gap-1 lg:hidden"
              role="tablist"
              aria-label="FlexFlow preview tabs"
            >
              {PREVIEW_NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-pressed={tab === item.id}
                  className={[
                    "rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition-colors",
                    tab === item.id
                      ? "bg-(--bg-overlay) text-(--text-primary)"
                      : "text-(--text-tertiary)",
                  ].join(" ")}
                >
                  <Translated>{item.label}</Translated>
                </button>
              ))}
            </div>

            <div className="min-h-52">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {tab === "dashboard" ? (
                    <PreviewDashboard />
                  ) : tab === "projects" ? (
                    <PreviewProjects />
                  ) : tab === "board" ? (
                    <PreviewBoard />
                  ) : tab === "team" ? (
                    <PreviewTeam />
                  ) : (
                    <PreviewIntelligence />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="border-t border-(--border) px-4 py-2.5 text-center text-[11px] text-(--text-tertiary)">
          <Translated>A look inside your dashboard click a section to explore.</Translated>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, align = "left", description }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-(--text-secondary)">{description}</p>
      ) : null}
    </div>
  );
}

export function LandingPageClient() {
  const { t } = useI18n();
  const minimizeMotion = useReducedMotion();
  const [billing, setBilling] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(faqs[0].question);

  const fadeUp = minimizeMotion
    ? { opacity: 1, y: 0 }
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.5, ease: "easeOut" },
      };

  const planFeatureLists = {
    free: PLANS.free.features.map((id) => getFeatureInfo(id)).filter(Boolean),
    pro: PLANS.pro.features
      .map((id) => getFeatureInfo(id))
      .filter(Boolean)
      .slice(0, 8),
    custom: [
      "SSO / SAML",
      "Custom roles",
      "Advanced audit logs",
      "Dedicated support",
      "Advanced security",
      "Unlimited Team Intelligence",
    ],
  };

  return (
    <main className="min-h-screen bg-(--bg) text-(--text-primary)">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="border-b border-(--border)">
        <div className="mx-auto w-full max-w-7xl px-6 pt-18 pb-20 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-5xl font-semibold tracking-tight text-(--text-primary) md:text-7xl">
              {t("landing.heroTitle")}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-(--text-secondary) md:text-lg">
              {t("landing.heroSubtitle")}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  {t("landing.startBuildingFree")}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                </Link>
              </Button>

              <Button asChild variant="secondary" size="lg">
                <Link href="/login">{t("common.signIn")}</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-(--text-tertiary)">
              {t("landing.noCreditCard")}
            </p>
          </motion.div>

          <motion.div {...fadeUp} className="mx-auto mt-16 max-w-5xl">
            <AppPreview />
          </motion.div>
        </div>
      </section>

      {/* ── Team Intelligence (the differentiator) ───────────────────── */}
      <section
        id="intelligence"
        className="scroll-mt-20 border-b border-(--border) bg-(--bg-elevated) py-24"
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                eyebrow={<Translated>Team Intelligence</Translated>}
                title={<Translated>Ask anything. Your team&apos;s history answers with receipts.</Translated>}
                description={<Translated>Team Intelligence turns tokens of work into organizational memory. Tasks, projects, comments, activity, and decisions become answerable in plain English scoped to what each person is allowed to see.</Translated>}
              />
              <ul className="mt-8 space-y-3">
                {[
                  "Answers cite the exact source task, comment, or decision entry",
                  "Respects RBAC, workspace, and organization boundaries on every query",
                  "Never invents facts or reveals data you don't have access to",
                  "Pro gets 50 questions/day; Custom gets unlimited plus a decision memory",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-(--text-secondary)">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-600">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <Translated>{point}</Translated>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/register">
                    <Translated>Start with Team Intelligence</Translated>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/pricing">{t("common.seePricing")}</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {intelligenceQuestions.map((item) => (
                <motion.div
                  key={item.question}
                  {...fadeUp}
                  className="rounded-2xl border border-(--border) bg-(--bg) p-5"
                >
                  <p className="flex items-start gap-2.5 text-sm font-semibold text-(--text-primary)">
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={1.7} />
                    <Translated>{item.question}</Translated>
                  </p>
                  <p className="mt-3 flex items-start gap-2.5 rounded-xl bg-(--bg-overlay) p-4 text-sm leading-relaxed text-(--text-secondary)">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={1.7} />
                    <Translated>{item.answer}</Translated>
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-(--text-tertiary)">
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={1.7} />
                    <Translated>{item.source}</Translated>
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-24 lg:px-8">
        <SectionHeading
          eyebrow={<Translated>Features</Translated>}
          title={<Translated>Everything your team needs to move work forward.</Translated>}
          description={<Translated>One workspace for planning, permissions, execution, review, and delivery no duct-taped integrations.</Translated>}
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.04 }}
                className="group rounded-2xl border border-(--border) bg-(--bg-elevated) p-6 transition-colors hover:border-(--border-strong)"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--bg-overlay) text-brand-500 transition-colors group-hover:border-brand-500/40">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-(--text-primary)"><Translated>{feature.title}</Translated></h3>
                <p className="mt-2.5 text-sm leading-relaxed text-(--text-secondary)">
                  <Translated>{feature.description}</Translated>
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          {...fadeUp}
          className="mt-5 rounded-2xl border border-brand-500/40 bg-brand-600 p-8"
        >
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h3 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                <Translated>From signup to shipping no migrations, no setup spreadsheets.</Translated>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                <Translated>Invite your team, create your first project, and assign tasks the same day.</Translated>
              </p>
            </div>
            <Button asChild size="lg" className="bg-white text-brand-700 shadow-md hover:bg-white/90">
              <Link href="/register">
                <Translated>Create workspace</Translated>
                <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-(--border) bg-(--bg-elevated) py-24"
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <SectionHeading
            eyebrow={<Translated>How it works</Translated>}
            title={<Translated>A simple flow from setup to shipping.</Translated>}
            description={<Translated>Three steps. No tutorials required.</Translated>}
            align="center"
          />

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.08 }}
                className="rounded-2xl border border-(--border) bg-(--bg) p-8"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--bg-overlay) text-sm font-semibold text-brand-500">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-(--text-primary)"><Translated>{step.title}</Translated></h3>
                <p className="mt-2.5 text-sm leading-relaxed text-(--text-secondary)">
                  <Translated>{step.description}</Translated>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────── */}
      <section id="integrations" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-24 lg:px-8">
        <SectionHeading
          eyebrow={<Translated>Integrations</Translated>}
          title={<Translated>Work where your team already works.</Translated>}
          description={<Translated>Connect the tools you&apos;re running today, or build on top of the API.</Translated>}
          align="center"
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {integrations.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.04 }}
                className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--bg-overlay) text-brand-500">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-(--text-primary)"><Translated>{item.name}</Translated></h3>
                <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)"><Translated>{item.detail}</Translated></p>
                <span className="mt-3 inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-500">
                  <Translated>{item.name === "Slack" || item.name === "GitHub" ? "Pro plan" : "All plans"}</Translated>
                </span>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────── */}
      <section
        id="security"
        className="scroll-mt-20 border-y border-(--border) bg-(--bg-elevated) py-24"
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow={<Translated>Security</Translated>}
                title={<Translated>Permissions aren&apos;t decoration they&apos;re enforced.</Translated>}
                description={<Translated>Every role, workspace, and plan boundary is checked on the server. UI gating is just the ergonomics; the API is where access is actually decided.</Translated>}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {securityPoints.map((point, index) => (
                <motion.div
                  key={point}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.03 }}
                  className="flex items-start gap-3 rounded-xl border border-(--border) bg-(--bg) p-4"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-600">
                    <CheckCircle className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="text-sm text-(--text-secondary)"><Translated>{point}</Translated></span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-24 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow={<Translated>Pricing</Translated>}
            title={<Translated>Start free, scale when your team grows.</Translated>}
            description={<Translated>Transparent plans with no hidden costs. Upgrade or cancel anytime.</Translated>}
          />

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-(--border) bg-(--bg-elevated) p-1">
              {["monthly", "annual"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBilling(option)}
                  aria-pressed={billing === option}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
                    billing === option
                      ? "bg-brand-600 text-white"
                      : "text-(--text-secondary) hover:text-(--text-primary)",
                  ].join(" ")}
                >
                  <Translated>{option}</Translated>
                </button>
              ))}
            </div>
            <span className="rounded-full border border-success-500/40 bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500">
              <Translated>Save 30%</Translated>
            </span>
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {[
            {
              key: "free",
              name: "Free",
              price: billing === "monthly" ? "$0" : "$0",
              cadence: "/forever",
              description: "For small teams and evaluating the product.",
              features: planFeatureLists.free.slice(0, 6).map((f) => f.name),
              cta: "Start free",
              highlighted: false,
            },
            {
              key: "pro",
              name: "Pro",
              price: billing === "monthly" ? `$${PLANS.pro.priceMonthly}` : `$${PLANS.pro.priceAnnual}`,
              cadence: billing === "monthly" ? "/member / month" : "/member / year",
              description: "For teams shipping real products.",
              features: planFeatureLists.pro.map((f) => f.name),
              cta: "Start Pro",
              highlighted: true,
            },
            {
              key: "custom",
              name: "Custom",
              price: `From $${PLANS.custom.priceMonthly}`,
              cadence: "/mo · configurable",
              description: "For organizations with enterprise requirements.",
              features: planFeatureLists.custom,
              cta: "Build custom plan",
              highlighted: false,
            },
          ].map((plan, index) => (
            <motion.div
              key={plan.key}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.06 }}
              className={[
                "relative flex flex-col rounded-2xl border p-6 lg:p-7",
                plan.highlighted ? "border-brand-500/60 shadow-lg" : "border-(--border) bg-(--bg-elevated)",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-(--text-primary)"><Translated>{plan.name}</Translated></h3>
                {plan.highlighted ? (
                  <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500">
                    {t("landing.mostPopular")}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                <Translated>{plan.description}</Translated>
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight text-(--text-primary)">
                  {plan.price}
                </span>
                <span className="pb-1 text-sm text-(--text-tertiary)">{plan.cadence}</span>
              </div>

              <div className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-600">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm text-(--text-secondary)"><Translated>{feature}</Translated></span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="mt-8 w-full"
                variant={plan.highlighted ? "primary" : "secondary"}
              >
                <Link href={plan.key === "custom" ? "/pricing#custom" : "/register"}>
                  <Translated>{plan.cta}</Translated>
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-(--text-tertiary)">
          <Translated>Need custom roles, audit logs, or SSO?</Translated>{" "}
          <Link href="/pricing#custom" className="font-medium text-brand-500 hover:text-brand-400">
            <Translated>Build a custom plan</Translated>
          </Link>{" "}
          <Translated>or</Translated>{" "}
          <Link href="/contact" className="font-medium text-brand-500 hover:text-brand-400">
            <Translated>talk to sales</Translated>
          </Link>
          <Translated>.</Translated>
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto w-full max-w-4xl scroll-mt-20 px-6 pb-24 lg:px-8">
        <SectionHeading
          eyebrow={<Translated>FAQ</Translated>}
          title={<Translated>Questions teams ask before switching.</Translated>}
          align="center"
        />

        <div className="mt-12 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === faq.question;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-(--border) bg-(--bg-elevated)"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? "" : faq.question)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                >
                  <span className="text-sm font-semibold text-(--text-primary)">
                    <Translated>{faq.question}</Translated>
                  </span>
                  <ChevronDown
                    className={[
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180 text-brand-500" : "text-(--text-tertiary)",
                    ].join(" ")}
                    strokeWidth={1.7}
                  />
                </button>

                <div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-button-${index}`}
                  className={[
                    "grid transition-all duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  ].join(" ")}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-(--text-secondary)">
                      <Translated>{faq.answer}</Translated>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="scroll-mt-20 border-t border-(--border) bg-(--bg-elevated) py-24"
      >
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow={<Translated>Contact</Translated>}
                title={<Translated>Talk to a human.</Translated>}
                description={<Translated>Sales, support, partnerships, or feedback all the same inbox. We usually reply within one business day.</Translated>}
              />
              <div className="mt-8 space-y-4 text-sm text-(--text-secondary)">
                <p>
                  <strong className="text-(--text-primary)"><Translated>Sales</Translated></strong>{" "}
                  <Link href="/pricing" className="font-medium text-brand-500 hover:text-brand-400">
                    <Translated>see pricing</Translated>
                  </Link>{" "}
                  <Translated>or email</Translated>{" "}
                  <a href="mailto:sales@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
                    sales@flexflow.app
                  </a>
                </p>
                <p>
                  <strong className="text-(--text-primary)"><Translated>Support</Translated></strong>{" "}
                  <Translated>find answers in the</Translated>{" "}
                  <Link href="/help" className="font-medium text-brand-500 hover:text-brand-400">
                    <Translated>help center</Translated>
                  </Link>{" "}
                  <Translated>or email</Translated>{" "}
                  <a href="mailto:support@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
                    support@flexflow.app
                  </a>
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-(--border) bg-(--bg) p-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-brand-500/40 bg-brand-600 px-6 py-16 text-center lg:px-12 lg:py-20">
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              <Translated>Give your team a workspace that remembers.</Translated>
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              <Translated>Start with a polished workspace and scale into full role-based access control, review workflows, analytics, and Team Intelligence when you&apos;re ready.</Translated>
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-brand-700 shadow-md hover:bg-white/90">
                <Link href="/register">
                  <Translated>Create workspace</Translated>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">{t("common.signIn")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}