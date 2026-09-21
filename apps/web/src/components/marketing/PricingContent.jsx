"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Minus, Sparkles } from "lucide-react";
import { Translated } from "@/lib/translate";

import {
  PLANS,
  FEATURES,
  CUSTOM_ADDONS,
  CUSTOM_ENTERPRISE_BASE,
  PLAN_ORDER,
  PLAN_RANK,
  getFeatureInfo,
} from "@flexflow/plans";
import { Button } from "@/components/ui/Button";

const CATEGORY_ORDER = [
  "Core",
  "Collaboration",
  "Access",
  "Workspace",
  "Integrations",
  "Insights",
  "Automation",
  "Security",
  "Governance",
  "Intelligence",
  "Platform",
  "Support",
];

const FAQS = [
  {
    question: "What does each plan include?",
    answer:
      "Free covers 1 organization, 2 workspaces, 3 projects, and 50 tasks a month  with kanban boards, basic roles, and real-time collaboration for up to 10 members. Pro adds multiple organizations, advanced RBAC, analytics, GitHub and Slack integrations, and 50 Team Intelligence queries a day. Custom adds SSO, audit logs, custom roles, and other enterprise add-ons.",
  },
  {
    question: "Can I switch plans after I sign up?",
    answer:
      "Yes. Upgrade to Pro or Custom anytime and entitlements activate once your payment is confirmed via card or bank transfer. Cancel and paid access continues until the end of your billing window, then the organization returns to the Free plan.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Pay by card securely through Paystack, or pay by bank transfer to our OPay or PalmPay account and upload your receipt of payment. Card details are tokenized by Paystack and never touch our servers. Transfers are verified before your plan activates.",
  },
  {
    question: "Is billing per member?",
    answer:
      "Plan pricing is per organization per month, not per member. Add as many members as your plan allows.",
  },
  {
    question: "What is Team Intelligence?",
    answer:
      "It turns your team's work  tasks, projects, comments, activity, and decision memory  into a knowledge base you can ask questions against. Answers cite their sources and respect what each person is allowed to see.",
  },
  {
    question: "What is the Custom plan?",
    answer:
      "Custom is the Pro foundation plus enterprise add-ons you configure yourself  SSO, advanced audit logs, custom roles, advanced security, and more. Prices update live as you select add-ons.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer: "Yes  annual billing saves 30% on every paid configuration.",
  },
];

function Included({ value, locked = false }) {
  if (value)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-success-500/15 text-success-600">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-(--bg-overlay) text-(--text-tertiary)"
      aria-label={locked ? <Translated>Available on Custom</Translated> : <Translated>Not included</Translated>}
    >
      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

export function PricingContent() {
  const minimizeMotion = useReducedMotion();
  const [billing, setBilling] = useState("MONTHLY");
  const [openFaq, setOpenFaq] = useState(FAQS[0].question);
  const [selectedAddOns, setSelectedAddOns] = useState([]);

  const isAnnual = billing === "ANNUAL";

  const fadeUp = minimizeMotion
    ? { opacity: 1, y: 0 }
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.4, ease: "easeOut" },
      };

  const planPrice = (planId) => {
    const plan = PLANS[planId];
    if (planId === "free") return "$0";
    if (planId === "custom") return `From $${PLANS.custom.priceMonthly}`;
    return isAnnual ? `$${plan.priceAnnual}` : `$${plan.priceMonthly}`;
  };

  const planCadence = (planId) => {
    if (planId === "free") return "/forever";
    if (planId === "custom") return "/mo · configurable";
    return isAnnual ? "/member / year" : "/member / month";
  };

  // Comparison table rows, grouped by category.
  const rows = useMemo(() => {
    const grouped = {};
    for (const feature of Object.values(FEATURES)) {
      const cat = feature.category || "Core";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(feature);
    }
    const order = [
      ...CATEGORY_ORDER,
      ...Object.keys(grouped).filter((cat) => !CATEGORY_ORDER.includes(cat)),
    ];
    return order
      .filter((cat) => grouped[cat]?.length)
      .map((cat) => ({
        category: cat,
        features: grouped[cat].sort((a, b) => PLAN_RANK[a.minPlan] - PLAN_RANK[b.minPlan]),
      }));
  }, []);

  const customEstimate = useMemo(() => {
    const addonMonthly = selectedAddOns.reduce(
      (sum, id) => sum + (CUSTOM_ADDONS[id]?.priceMonthly || 0),
      0,
    );
    const monthly = CUSTOM_ENTERPRISE_BASE + addonMonthly;
    const annual = Math.round(monthly * 12 * 0.7);
    return { monthly, annual };
  }, [selectedAddOns]);

  return (
    <div className="mt-12 space-y-20">
      {/* ── Plan cards ─────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-(--border) bg-(--bg-elevated) p-1">
              {["MONTHLY", "ANNUAL"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBilling(option)}
                  aria-pressed={billing === option}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    billing === option
                      ? "bg-brand-600 text-white"
                      : "text-(--text-secondary) hover:text-(--text-primary)",
                  ].join(" ")}
                >
                  {option === "MONTHLY" ? <Translated>Monthly</Translated> : <Translated>Annual</Translated>}
                </button>
              ))}
            </div>
            <span className="rounded-full border border-success-500/40 bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500">
              <Translated>Save 30% annually</Translated>
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((planId, index) => {
            const plan = PLANS[planId];
            const custom = planId === "custom";
            const featureList = custom
              ? ["Everything in Pro", "SSO / SAML", "Advanced audit logs", "Custom roles", "Advanced security", "Unlimited Team Intelligence"]
              : plan.features
                  .slice(0, planId === "free" ? 6 : 7)
                  .map((id) => getFeatureInfo(id))
                  .filter(Boolean)
                  .map((f) => f.name);
            return (
              <motion.div
                key={planId}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: minimizeMotion ? 0 : index * 0.06 }}
                className={[
                  "relative flex flex-col rounded-2xl border p-6 lg:p-7",
                  plan.highlight ? "border-brand-500/60 shadow-lg" : "border-(--border) bg-(--bg-elevated)",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-(--text-primary)"><Translated>{plan.name}</Translated></h3>
                  {plan.highlight ? (
                    <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500">
                      <Translated>Most popular</Translated>
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                  <Translated>{custom ? "Pro foundation plus enterprise add-ons, configured your way." : plan.tagline}</Translated>
                </p>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-(--text-primary)">
                    {planPrice(planId)}
                  </span>
                  <span className="pb-1 text-sm text-(--text-tertiary)">{planCadence(planId)}</span>
                </div>

                {plan.limits.members !== Infinity && (
                  <p className="mt-1 text-xs text-(--text-tertiary)">
                    <Translated>Up to {plan.limits.members.toLocaleString()} members · {plan.limits.workspaces === Infinity ? "unlimited" : plan.limits.workspaces} workspaces</Translated>
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-3">
                  {featureList.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-600">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span className="text-sm text-(--text-secondary)"><Translated>{feature}</Translated></span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="mt-8 w-full"
                  variant={plan.highlight ? "primary" : "secondary"}
                >
                  <Link href={custom ? "/pricing#custom" : "/register"}><Translated>{plan.cta}</Translated></Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Comparison table ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-(--border)">
        <div className="border-b border-(--border) px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-(--text-primary)">
            <Translated>Compare every feature</Translated>
          </h2>
          <p className="mt-1 text-sm text-(--text-secondary)">
            <Translated>Custom-tier features unlock when you purchase their add-on below.</Translated>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-160 border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--border) text-left">
                <th className="px-6 py-3 font-medium text-(--text-tertiary)"><Translated>Feature</Translated></th>
                <th className="w-24 px-4 py-3 text-center font-medium text-(--text-tertiary)"><Translated>Free</Translated></th>
                <th className="w-24 px-4 py-3 text-center font-semibold text-brand-500"><Translated>Pro</Translated></th>
                <th className="w-24 px-4 py-3 text-center font-medium text-(--text-tertiary)"><Translated>Custom</Translated></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ category, features }) => (
                <Fragment key={category}>
                  <tr className="border-b border-(--border) bg-(--bg-elevated)">
                    <td colSpan={4} className="px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-(--text-tertiary)">
                      <Translated>{category}</Translated>
                    </td>
                  </tr>
                  {features.map((feature) => {
                    const rank = PLAN_RANK[feature.minPlan];
                    return (
                      <tr
                        key={feature.id}
                        className="border-b border-(--border) last:border-b-0 hover:bg-(--bg-overlay)/50"
                      >
                        <td className="px-6 py-3">
                          <span className="font-medium text-(--text-primary)"><Translated>{feature.name}</Translated></span>
                          <span className="block text-xs text-(--text-tertiary)"><Translated>{feature.summary}</Translated></span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Included value={rank <= 0} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Included value={rank <= 1} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rank <= 2 ? (
                            <Included value />
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-warning-500/15 text-warning-500" title="Add-on">
                              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Custom configurator ────────────────────────────────────── */}
      <section id="custom" className="scroll-mt-24">
        <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6 lg:p-8">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-500" />
                <h2 className="text-lg font-semibold tracking-tight text-(--text-primary)">
                  <Translated>Build your Custom plan</Translated>
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                <Translated>Start with everything in Pro, then add the enterprise capabilities your organization needs. Price updates live.</Translated>
              </p>

              <div className="mt-6 grid gap-2.5 md:grid-cols-2">
                {Object.values(CUSTOM_ADDONS).map((addon) => {
                  const selected = selectedAddOns.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() =>
                        setSelectedAddOns((prev) =>
                          selected ? prev.filter((id) => id !== addon.id) : [...prev, addon.id],
                        )
                      }
                      aria-pressed={selected}
                      className={[
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-brand-500/50 bg-brand-500/5"
                          : "border-(--border) hover:border-(--border-strong)",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border",
                          selected ? "border-brand-600 bg-brand-600 text-white" : "border-(--border-strong)",
                        ].join(" ")}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-(--text-primary)">
                            <Translated>{addon.name}</Translated>
                            <span className="text-xs text-(--text-tertiary)">+${addon.priceMonthly}/mo</span>
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-(--text-muted)">
                            <Translated>{addon.description}</Translated>
                          </span>
                        </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-(--border) bg-(--bg) p-6">
              <p className="text-sm font-semibold text-(--text-primary)"><Translated>Your estimate</Translated></p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-(--text-secondary)">
                  <span><Translated>Pro base</Translated></span>
                  <span>${PLANS.pro.priceMonthly}/mo</span>
                </div>
                <div className="flex items-center justify-between text-(--text-secondary)">
                  <span><Translated>Enterprise base</Translated></span>
                  <span>${CUSTOM_ENTERPRISE_BASE}/mo</span>
                </div>
                <div className="flex items-center justify-between text-(--text-secondary)">
                  <span><Translated>Add-ons ({selectedAddOns.length})</Translated></span>
                  <span>
                    +
                    {selectedAddOns.reduce((sum, id) => sum + (CUSTOM_ADDONS[id]?.priceMonthly || 0), 0)}
                    /mo
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-(--border) pt-3">
                  <span className="font-semibold text-(--text-primary)"><Translated>Monthly</Translated></span>
                  <span className="text-xl font-bold text-(--text-primary)">${customEstimate.monthly}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-(--text-secondary)"><Translated>Annual (save 30%)</Translated></span>
                  <span className="font-semibold text-(--text-primary)">
                    ${customEstimate.annual}/yr · ${Math.round(customEstimate.annual / 12)}/mo
                  </span>
                </div>
              </div>
              <Button asChild className="mt-6 w-full">
                <Link href="/register"><Translated>Start on Custom</Translated></Link>
              </Button>
              <Button asChild variant="secondary" className="mt-3 w-full">
                <Link href="/contact"><Translated>Talk to sales</Translated></Link>
              </Button>
              <p className="mt-3 text-center text-xs text-(--text-tertiary)">
                <Translated>No credit card required to start.</Translated>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Which plan is right for you ────────────────────────────── */}
      <section className="rounded-2xl border border-(--border) p-6">
        <h2 className="text-base font-semibold text-(--text-primary)"><Translated>Which plan is right for you?</Translated></h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-(--text-secondary)">
          <li>
            <strong className="text-(--text-primary)">Free</strong> <Translated> great for trying FlexFlow, a
            new product, or small teams that stay within one workspace.</Translated>
          </li>
          <li>
            <strong className="text-(--text-primary)">Pro</strong> <Translated> best for growing teams that
            need multiple organizations, advanced permissions, analytics, and integrations.</Translated>
          </li>
          <li>
            <strong className="text-(--text-primary)">Custom</strong> <Translated> for organizations with SSO,
            audit, custom roles, or compliance requirements. Configure it yourself or talk to sales.</Translated>
          </li>
        </ul>
        <p className="mt-4 text-sm text-(--text-tertiary)">
          <Translated>Questions? Read our</Translated>{" "}
          <Link href="/docs" className="font-medium text-brand-500 hover:text-brand-400">
            <Translated>documentation</Translated>
          </Link>{" "}
          <Translated>or</Translated>{" "}
          <Link href="/contact" className="font-medium text-brand-500 hover:text-brand-400">
            <Translated>contact us</Translated>
          </Link>
          <Translated>.</Translated>
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-center text-2xl font-semibold tracking-tight text-(--text-primary)">
          <Translated>Frequently asked questions</Translated>
        </h2>
        <div className="mx-auto mt-8 max-w-3xl space-y-3">
          {FAQS.map((faq, index) => {
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
                  aria-controls={`pricing-faq-panel-${index}`}
                >
                  <span className="text-sm font-semibold text-(--text-primary)"><Translated>{faq.question}</Translated></span>
                  <ChevronDown
                    className={[
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180 text-brand-500" : "text-(--text-tertiary)",
                    ].join(" ")}
                    strokeWidth={1.7}
                  />
                </button>
                <div
                  id={`pricing-faq-panel-${index}`}
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
    </div>
  );
}