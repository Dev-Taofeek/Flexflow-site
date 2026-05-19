"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  GitBranch,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const features = [
  {
    title: "Role-based access control",
    description:
      "Create Owner, Admin, Member, and Viewer permissions with clean workspace-level control.",
    icon: ShieldCheck,
  },
  {
    title: "Project workflows",
    description:
      "Plan work with projects, issues, labels, comments, subtasks, and deadline tracking.",
    icon: Workflow,
  },
  {
    title: "Live collaboration",
    description:
      "Keep teams in sync with real-time issue updates, comments, activity logs, and presence-ready architecture.",
    icon: Users,
  },
  {
    title: "Kanban execution",
    description:
      "Move work across To Do, In Progress, In Review, and Done with a polished drag-and-drop board.",
    icon: GitBranch,
  },
  {
    title: "Team communication",
    description:
      "Use comments, mentions, pending invites, role dropdowns, and notification-ready workflows.",
    icon: MessageSquare,
  },
  {
    title: "Analytics dashboards",
    description:
      "Track velocity, workload, burndown, cycle time, and delivery health with responsive charts.",
    icon: BarChart3,
  },
];

const steps = [
  {
    title: "Create your workspace",
    description: "Set up your organization, invite teammates, and assign initial roles in minutes.",
  },
  {
    title: "Plan and prioritize",
    description:
      "Create projects, define issues, add labels, assign owners, and organize deadlines.",
  },
  {
    title: "Ship with confidence",
    description:
      "Track progress, review activity, monitor analytics, and keep every teammate aligned.",
  },
];

const pricing = {
  monthly: [
    {
      name: "Free",
      price: "$0",
      description: "For solo builders and small experiments.",
      features: ["1 workspace", "3 projects", "Basic Kanban", "Community support"],
      cta: "Start free",
    },
    {
      name: "Pro",
      price: "$12",
      description: "For growing teams shipping real products.",
      features: ["Unlimited projects", "RBAC roles", "Analytics", "Priority support"],
      cta: "Start Pro",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For organizations with advanced security needs.",
      features: ["Custom roles", "Audit logs", "SSO-ready", "Dedicated support"],
      cta: "Contact sales",
    },
  ],
  annual: [
    {
      name: "Free",
      price: "$0",
      description: "For solo builders and small experiments.",
      features: ["1 workspace", "3 projects", "Basic Kanban", "Community support"],
      cta: "Start free",
    },
    {
      name: "Pro",
      price: "$99",
      description: "For growing teams shipping real products.",
      features: ["Unlimited projects", "RBAC roles", "Analytics", "Priority support"],
      cta: "Start Pro",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For organizations with advanced security needs.",
      features: ["Custom roles", "Audit logs", "SSO-ready", "Dedicated support"],
      cta: "Contact sales",
    },
  ],
};

const faqs = [
  {
    question: "Is FlexFlow built for engineering teams?",
    answer:
      "Yes. FlexFlow is designed around projects, issues, roles, comments, activity logs, analytics, and team workflows.",
  },
  {
    question: "Does it support role-based permissions?",
    answer:
      "Yes. The platform includes Owner, Admin, Member, and Viewer roles with a visual permission matrix.",
  },
  {
    question: "Can teams collaborate in real time?",
    answer:
      "Yes. Issue updates use Socket.io-powered live sync, so board changes and issue updates can be reflected across clients.",
  },
  {
    question: "Is this responsive?",
    answer:
      "Yes. The app shell, dashboard, projects, team, analytics, settings, and marketing pages are designed for desktop, tablet, and mobile.",
  },
];

export function LandingPageClient() {
  const [billing, setBilling] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(faqs[0].question);

  return (
    <main className="bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark min-h-screen">
      <section className="border-border dark:border-border-dark relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_45%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.24),transparent_45%)]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-brand-600 dark:bg-brand-500 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white">
              FF
            </div>

            <span className="text-sm font-semibold">FlexFlow</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {["Features", "How it works", "Pricing", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark text-sm font-medium transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>

            <Button asChild>
              <Link href="/register">
                Get started
                <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 text-center lg:px-8 lg:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mx-auto max-w-4xl"
          >
            <Badge variant="secondary" className="mx-auto">
              <Sparkles className="mr-2 h-3.5 w-3.5" strokeWidth={1.7} />
              RBAC and team collaboration for modern SaaS teams
            </Badge>

            <h1 className="text-foreground dark:text-foreground-dark mt-8 text-5xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
              Plan, assign, track, and ship with one polished workspace.
            </h1>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mx-auto mt-6 max-w-2xl text-base leading-8 md:text-lg">
              FlexFlow brings projects, issues, permissions, comments, workflows, analytics, and
              team management into a clean dashboard inspired by Linear, Vercel, and Notion.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Start building
                  <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                </Link>
              </Button>

              <Button asChild variant="secondary" size="lg">
                <Link href="/dashboard">View dashboard</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.55, ease: "easeOut" }}
            className="border-border bg-surface/80 dark:border-border-dark dark:bg-surface-dark/80 mx-auto mt-16 max-w-6xl rounded-[2rem] border p-3 shadow-md backdrop-blur"
          >
            <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark overflow-hidden rounded-[1.5rem] border">
              <div className="border-border dark:border-border-dark flex items-center gap-2 border-b px-4 py-3">
                <span className="bg-danger-500 h-3 w-3 rounded-full" />
                <span className="bg-warning-500 h-3 w-3 rounded-full" />
                <span className="bg-success-500 h-3 w-3 rounded-full" />
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[240px_1fr]">
                <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark hidden rounded-2xl border p-4 lg:block">
                  <div className="bg-muted dark:bg-muted-dark h-8 w-28 rounded-lg" />
                  <div className="mt-8 space-y-3">
                    {["Dashboard", "Projects", "Issues", "Team", "Analytics"].map((item, index) => (
                      <div
                        key={item}
                        className={[
                          "h-10 rounded-xl",
                          index === 1 ? "bg-brand-600/15" : "bg-muted dark:bg-muted-dark",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    {[103, "3.4d", "82%", "91%"].map((item) => (
                      <div
                        key={item}
                        className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-4 text-left"
                      >
                        <p className="text-2xl font-semibold">{item}</p>
                        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                          Workspace metric
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-5">
                      <div className="flex items-end gap-2">
                        {[38, 62, 48, 82, 70, 96].map((height, index) => (
                          <div
                            key={index}
                            className="bg-brand-600/80 dark:bg-brand-500/80 w-full rounded-t-lg"
                            style={{ height }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-5">
                      <div className="space-y-3">
                        {["Finalize RBAC matrix", "Review onboarding", "Ship analytics"].map(
                          (item) => (
                            <div
                              key={item}
                              className="bg-background dark:bg-background-dark flex items-center justify-between rounded-xl p-3"
                            >
                              <span className="text-sm font-medium">{item}</span>
                              <Check className="text-success-500 h-4 w-4" />
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">Features</p>

          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Everything your team needs to move work forward.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6"
              >
                <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </div>

                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark border-y py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">How it works</p>

            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              A simple flow from setup to shipping.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-3xl border p-6"
              >
                <div className="bg-brand-600 dark:bg-brand-500 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white">
                  {index + 1}
                </div>

                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">Pricing</p>

            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Start free, scale when your team grows.
            </h2>
          </div>

          <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark inline-flex rounded-xl border p-1">
            {["monthly", "annual"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setBilling(option)}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
                  billing === option
                    ? "bg-brand-600 dark:bg-brand-500 text-white"
                    : "text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark",
                ].join(" ")}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pricing[billing].map((plan) => (
            <div
              key={plan.name}
              className={[
                "bg-surface dark:bg-surface-dark rounded-3xl border p-6",
                plan.highlighted
                  ? "border-brand-500 shadow-md"
                  : "border-border dark:border-border-dark",
              ].join(" ")}
            >
              {plan.highlighted ? <Badge>Most popular</Badge> : null}

              <h3 className="mt-5 text-xl font-semibold">{plan.name}</h3>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
                {plan.description}
              </p>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-semibold">{plan.price}</span>

                {plan.price !== "$0" && plan.price !== "Custom" ? (
                  <span className="text-muted-foreground dark:text-muted-foreground-dark pb-1 text-sm">
                    /{billing === "monthly" ? "month" : "year"}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="text-success-500 h-4 w-4" strokeWidth={1.7} />
                    <span className="text-muted-foreground dark:text-muted-foreground-dark text-sm">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="mt-8 w-full"
                variant={plan.highlighted ? "primary" : "secondary"}
              >
                <Link href="/register">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section
        id="faq"
        className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark border-y py-24"
      >
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">FAQ</p>

            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Questions teams ask before switching.
            </h2>
          </div>

          <div className="mt-12 space-y-3">
            {faqs.map((faq) => {
              const isOpen = openFaq === faq.question;

              return (
                <div
                  key={faq.question}
                  className="border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-2xl border"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? "" : faq.question)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold">{faq.question}</span>

                    <ChevronDown
                      className={["h-4 w-4 transition-transform", isOpen ? "rotate-180" : ""].join(
                        " "
                      )}
                      strokeWidth={1.7}
                    />
                  </button>

                  {isOpen ? (
                    <div className="text-muted-foreground dark:text-muted-foreground-dark px-5 pb-5 text-sm leading-relaxed">
                      {faq.answer}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-[2rem] border p-8 text-center lg:p-12">
          <div className="bg-brand-600 dark:bg-brand-500 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white">
            <Zap className="h-6 w-6" strokeWidth={1.7} />
          </div>

          <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold tracking-tight">
            Give your team a cleaner way to plan, collaborate, and ship.
          </h2>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mx-auto mt-4 max-w-xl text-sm leading-relaxed">
            Start with a polished workspace foundation and scale into full RBAC, analytics, and
            collaboration workflows.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Create workspace
                <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
              </Link>
            </Button>

            <Button asChild variant="secondary" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
