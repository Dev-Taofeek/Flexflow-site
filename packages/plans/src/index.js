// ─────────────────────────────────────────────────────────────────────────────
// FlexFlow plans — single source of truth for plans, features, limits, prices.
//
// Used by:
//   • apps/api  → entitlements enforcement, billing service, usage limits
//   • apps/web  → pricing page, plan badges, upgrade prompts, configurators
//
// Two simple rules keep the whole system consistent:
//   • Every feature has a `minPlan` ("free" | "pro" | "custom"). A plan can use
//     a feature when the feature's `minPlan` ranks at or below the plan.
//   • PRO builds on FREE. CUSTOM is the PRO foundation plus purchasable
//     enterprise add-ons (one add-on per enterprise feature).
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_ORDER = ["free", "pro", "custom"];
export const PLAN_RANK = { free: 0, pro: 1, custom: 2 };

export const ANNUAL_DISCOUNT = 0.3; // 30% saved on annual billing

/** Base price of the CUSTOM plan ($20/mo). All nine enterprise add-ons sum to
 * $100, so a fully loaded Custom configuration costs exactly $120/month. */
export const CUSTOM_ENTERPRISE_BASE = 20;

/**
 * Enterprise add-ons — each one unlocks a `minPlan: "custom"` feature and adds
 * to the monthly/estimated price. Priced per organization per month.
 * All add-ons together add exactly $100/mo (20 + 100 = 120 max).
 */
export const CUSTOM_ADDONS = {
  sso: {
    id: "sso",
    name: "SSO / SAML",
    description: "Single sign-on with SAML, OIDC, and SCIM user provisioning.",
    value: "Centralize authentication and automatically provision/remove employees.",
    priceMonthly: 14,
  },
  audit_logs: {
    id: "audit_logs",
    name: "Advanced Audit Logs",
    description: "Immutable, exportable logs of every action across your organization.",
    value: "Prove compliance, investigate incidents, and understand how work actually happens.",
    priceMonthly: 10,
  },
  custom_roles: {
    id: "custom_roles",
    name: "Custom Roles",
    description: "Design unlimited roles with granular permission matrices.",
    value: "Mirror your company's exact hierarchy instead of adapting to a fixed set.",
    priceMonthly: 12,
  },
  advanced_security: {
    id: "advanced_security",
    name: "Advanced Security",
    description: "Org-level security policies, IP allow-listing, and session controls.",
    value: "Meet internal security review requirements and reduce breach surface.",
    priceMonthly: 14,
  },
  dedicated_support: {
    id: "dedicated_support",
    name: "Dedicated Support",
    description: "A named support engineer with a 1-hour SLA during business hours.",
    value: "Never wait on a ticket when a launch is on the line.",
    priceMonthly: 10,
  },
  custom_integrations: {
    id: "custom_integrations",
    name: "Custom Integrations",
    description: "Private API/webhook builds and connectors for your internal tools.",
    value: "Plug FlexFlow into the exact systems your organization already runs on.",
    priceMonthly: 12,
  },
  api_limit_scale: {
    id: "api_limit_scale",
    name: "Increased API Limits",
    description: "Ten times your API request allowance with rate-limit priority.",
    value: "Automate at scale without tripping over throughput ceilings.",
    priceMonthly: 10,
  },
  data_retention: {
    id: "data_retention",
    name: "Data Retention",
    description: "Custom retention policies and export/backup controls.",
    value: "Satisfy legal hold, residency, and retention requirements.",
    priceMonthly: 8,
  },
  enterprise_automation: {
    id: "enterprise_automation",
    name: "Enterprise Automation",
    description: "Unlimited automation runs and advanced rule builders.",
    value: "Automate every repetitive workflow without a monthly budget wall.",
    priceMonthly: 10,
  },
};

/**
 * Feature catalog. `minPlan` is the cheapest plan that includes the feature.
 * CUSTOM-only features are unlocked by purchasing their add-on in CUSTOM_ADDONS.
 */
export const FEATURES = {
  // ── Free (baseline) ──────────────────────────────────────────────────────
  projects_tasks: {
    id: "projects_tasks",
    name: "Projects & tasks",
    summary: "3 projects and 50 tasks a month on Free; unlimited on Pro and Custom.",
    value: "A starter cap that scales the moment you upgrade.",
    minPlan: "free",
    category: "Core",
  },
  kanban_boards: {
    id: "kanban_boards",
    name: "Kanban boards",
    summary: "Drag work across To Do, In Progress, In Review, and Done.",
    value: "Keep the whole team visibly aligned on what is moving.",
    minPlan: "free",
    category: "Core",
  },
  core_rbac: {
    id: "core_rbac",
    name: "Basic RBAC",
    summary: "Owner, Admin, Member, and Viewer roles enforced per workspace.",
    value: "Give everyone the least privilege they need from day one.",
    minPlan: "free",
    category: "Access",
  },
  basic_analytics: {
    id: "basic_analytics",
    name: "Basic analytics",
    summary: "Personal dashboard with my tasks, project progress, and deadlines.",
    value: "Everyone sees their own delivery picture in seconds.",
    minPlan: "free",
    category: "Insights",
  },
  team_collaboration: {
    id: "team_collaboration",
    name: "Standard collaboration",
    summary: "Comments, mentions-style notifications, labels, and real-time sync.",
    value: "Fewer meetings, less context switching, all updates in one place.",
    minPlan: "free",
    category: "Collaboration",
  },
  community_support: {
    id: "community_support",
    name: "Community support",
    summary: "Docs, help center, and community answers.",
    value: "Self-serve answers whenever you need them.",
    minPlan: "free",
    category: "Support",
  },
  basic_security: {
    id: "basic_security",
    name: "Basic security",
    summary: "Encryption at rest, SSO-friendly architecture, and per-user sessions.",
    value: "A secure-by-default foundation that still owns your data.",
    minPlan: "free",
    category: "Security",
  },
  basic_integrations: {
    id: "basic_integrations",
    name: "Basic integrations",
    summary: "Webhooks and API access for essential automation.",
    value: "Connect FlexFlow to the tools you already use.",
    minPlan: "free",
    category: "Integrations",
  },
  basic_automation: {
    id: "basic_automation",
    name: "Limited automation",
    summary: "A starter number of automated workflow runs each month.",
    value: "Automate the simple stuff without leaving the app.",
    minPlan: "free",
    category: "Automation",
  },
  api_access_basic: {
    id: "api_access_basic",
    name: "API access",
    summary: "Read/write access with a monthly request allowance.",
    value: "Build on top of your team's work programmatically.",
    minPlan: "free",
    category: "Platform",
  },
  realtime_collaboration: {
    id: "realtime_collaboration",
    name: "Real-time collaboration",
    summary: "Socket-powered live boards, tasks, and notifications.",
    value: "What you see is what your team sees — immediately.",
    minPlan: "free",
    category: "Core",
  },
  task_management: {
    id: "task_management",
    name: "Task tracking",
    summary: "Priorities, due dates, assignees, labels, and review workflows.",
    value: "Every piece of work has a clear owner and due date.",
    minPlan: "free",
    category: "Core",
  },

  // ── Pro (minPlan "pro") ──────────────────────────────────────────────────
  multiple_organizations: {
    id: "multiple_organizations",
    name: "Multiple organizations",
    summary: "Create and manage up to ten organizations from one account.",
    value: "Run client work, side projects, or subsidiaries in clean silos.",
    minPlan: "pro",
    category: "Workspace",
  },
  advanced_rbac: {
    id: "advanced_rbac",
    name: "Advanced RBAC",
    summary: "Customizable permission matrices with fine-grained controls.",
    value: "Make each team's permissions match how they actually work.",
    minPlan: "pro",
    category: "Access",
  },
  advanced_analytics: {
    id: "advanced_analytics",
    name: "Advanced analytics",
    summary: "Velocity, workload, cycle time, and burndown for the workspace.",
    value: "See where work slows down before it becomes a delivery problem.",
    minPlan: "pro",
    category: "Insights",
  },
  github_integration: {
    id: "github_integration",
    name: "GitHub integration",
    summary: "Connect repositories and link pull requests to tasks.",
    value: "Move code and delivery tracking into one continuous workflow.",
    minPlan: "pro",
    category: "Integrations",
  },
  slack_integration: {
    id: "slack_integration",
    name: "Slack integration",
    summary: "Post task updates and decision summaries to channels.",
    value: "Keep Slack informed without turning it into your system of record.",
    minPlan: "pro",
    category: "Integrations",
  },
  figma_integration: {
    id: "figma_integration",
    name: "Figma integration",
    summary: "Connect design files and link comments on files to tasks.",
    value: "Keep design feedback attached to the work it belongs to.",
    minPlan: "pro",
    category: "Integrations",
  },
  organization_2fa: {
    id: "organization_2fa",
    name: "Organization 2FA",
    summary: "Require two-factor authentication for every member of the org.",
    value: "Protect the whole organization, not just the security-minded few.",
    minPlan: "pro",
    category: "Security",
  },
  automation: {
    id: "automation",
    name: "Automation",
    summary: "Rule-based automation with a generous monthly run allowance.",
    value: "Assign, assignee, label, and status workflows that run themselves.",
    minPlan: "pro",
    category: "Automation",
  },
  advanced_collaboration: {
    id: "advanced_collaboration",
    name: "Advanced collaboration",
    summary: "Rich-text task editing, review cycles, and per-workspace roles.",
    value: "Coordinate complex work without spreading it over five tools.",
    minPlan: "pro",
    category: "Collaboration",
  },
  advanced_reporting: {
    id: "advanced_reporting",
    name: "Advanced reporting",
    summary: "Exportable reports and saved analytics views per workspace.",
    value: "Share delivery facts with stakeholders in one click.",
    minPlan: "pro",
    category: "Insights",
  },
  priority_support: {
    id: "priority_support",
    name: "Priority support",
    summary: "Faster responses from the support team, with a private channel.",
    value: "Unblock your team quickly when something is slowing you down.",
    minPlan: "pro",
    category: "Support",
  },
  customizable_permissions: {
    id: "customizable_permissions",
    name: "Customizable permissions",
    summary: "Tune the permission matrix resource-by-resource.",
    value: "Match every workspace's policy to its actual risk profile.",
    minPlan: "pro",
    category: "Access",
  },
  team_intelligence_limited: {
    id: "team_intelligence_limited",
    name: "Team Intelligence (Limited)",
    summary: "Ask your team's history questions — up to 50 per day.",
    value: "Turn months of scattered work into answers in seconds.",
    minPlan: "pro",
    category: "Intelligence",
  },

  // ── Custom (minPlan "custom", unlocked by add-ons) ───────────────────────
  sso: {
    id: "sso",
    name: "SSO / SAML",
    summary: "Single sign-on with SAML, OIDC, and SCIM provisioning.",
    value: "One identity system for the whole company — secure and automatic offboarding.",
    minPlan: "custom",
    addon: "sso",
    category: "Security",
  },
  audit_logs: {
    id: "audit_logs",
    name: "Advanced Audit Logs",
    summary: "Immutable, exportable record of every action across the org.",
    value: "Prove compliance and investigate incidents with full context.",
    minPlan: "custom",
    addon: "audit_logs",
    category: "Governance",
  },
  custom_roles: {
    id: "custom_roles",
    name: "Custom Roles",
    summary: "Unlimited bespoke roles with granular permission matrices.",
    value: "Model your exact hierarchy instead of adapting to a fixed one.",
    minPlan: "custom",
    addon: "custom_roles",
    category: "Access",
  },
  dedicated_support: {
    id: "dedicated_support",
    name: "Dedicated support",
    summary: "Named engineer with a 1-hour SLA during business hours.",
    value: "Human response times when it matters most.",
    minPlan: "custom",
    addon: "dedicated_support",
    category: "Support",
  },
  advanced_security: {
    id: "advanced_security",
    name: "Advanced security",
    summary: "Org security policies, session controls, and governance tooling.",
    value: "Meet enterprise security reviews and keep auditors happy.",
    minPlan: "custom",
    addon: "advanced_security",
    category: "Security",
  },
  custom_integrations: {
    id: "custom_integrations",
    name: "Custom integrations",
    summary: "Private connectors and webhook builds for internal tools.",
    value: "FlexFlow adapts to your stack — not the other way around.",
    minPlan: "custom",
    addon: "custom_integrations",
    category: "Integrations",
  },
  api_limit_scale: {
    id: "api_limit_scale",
    name: "Increased API limits",
    summary: "Ten times the API allowance with rate-limit priority.",
    value: "Automate at scale without throughput ceilings.",
    minPlan: "custom",
    addon: "api_limit_scale",
    category: "Platform",
  },
  data_retention: {
    id: "data_retention",
    name: "Data retention",
    summary: "Custom retention policies plus export and backup controls.",
    value: "Own your data lifecycle and satisfy legal requirements.",
    minPlan: "custom",
    addon: "data_retention",
    category: "Governance",
  },
  enterprise_automation: {
    id: "enterprise_automation",
    name: "Enterprise automation",
    summary: "Unlimited automation runs and advanced rule builders.",
    value: "Automate every workflow with no monthly budget wall.",
    minPlan: "custom",
    addon: "enterprise_automation",
    category: "Automation",
  },
  team_intelligence_full: {
    id: "team_intelligence_full",
    name: "Team Intelligence (Full)",
    summary: "Unlimited questions and a searchable decision memory.",
    value: "Your team's work becomes institutional knowledge anyone can query.",
    minPlan: "custom",
    category: "Intelligence",
  },
};

/** Convenience lookup for feature metadata. */
export function getFeatureInfo(featureKey) {
  return FEATURES[featureKey] || null;
}

/** Annual (per-year) price for a monthly price — honored by the configurator. */
export function annualize(monthlyPrice) {
  return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT));
}

/**
 * Plan catalog. Prices are per organization per month. `limits` are enforced
 * server-side; `features` derive from FEATURES but each base plan lists its own
 * bundle so callers can render plan comparisons directly.
 */
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    badge: "Free Plan",
    tagline: "For individuals, small teams, and evaluating the product.",
    description:
      "Get real work done — projects, tasks, boards, and core roles. No credit card required.",
    priceMonthly: 0,
    priceAnnual: 0,
    highlight: false,
    cta: "Start free",
    checkoutLabel: "Start free",
    limits: {
      organizations: 1,
      workspaces: 2,
      members: 10,
      projects: 3,
      tasksPerMonth: 50,
      storageMb: 1024,
      apiRequestsPerMonth: 10000,
      automationRunsPerMonth: 100,
      teamIntelligenceQueriesPerDay: 0,
    },
    features: [
      "task_management",
      "kanban_boards",
      "projects_tasks",
      "core_rbac",
      "basic_analytics",
      "team_collaboration",
      "realtime_collaboration",
      "basic_security",
      "basic_integrations",
      "basic_automation",
      "api_access_basic",
      "community_support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    badge: "Pro Plan",
    tagline: "For serious teams shipping real products.",
    description:
      "Multiple organizations, advanced RBAC, real analytics, and integrations for growing teams.",
    priceMonthly: 12,
    priceAnnual: 99,
    highlight: true,
    cta: "Start Pro",
    checkoutLabel: "Upgrade to Pro",
    limits: {
      organizations: 10,
      workspaces: 20,
      members: 50,
      projects: null,
      tasksPerMonth: null,
      storageMb: 10240,
      apiRequestsPerMonth: 250000,
      automationRunsPerMonth: 5000,
      teamIntelligenceQueriesPerDay: 50,
    },
    features: [
      "task_management",
      "kanban_boards",
      "projects_tasks",
      "advanced_rbac",
      "advanced_analytics",
      "advanced_reporting",
      "team_collaboration",
      "realtime_collaboration",
      "github_integration",
      "slack_integration",
      "figma_integration",
      "organization_2fa",
      "automation",
      "advanced_collaboration",
      "customizable_permissions",
      "priority_support",
      "multiple_organizations",
      "team_intelligence_limited",
    ],
  },
  custom: {
    id: "custom",
    name: "Custom",
    badge: "Custom Plan",
    tagline: "For organizations with enterprise requirements.",
    description:
      "Everything in Pro, plus a configurable set of enterprise add-ons. Self-serve pricing below.",
    priceMonthly: CUSTOM_ENTERPRISE_BASE,
    priceAnnual: annualize(CUSTOM_ENTERPRISE_BASE),
    highlight: false,
    cta: "Build custom plan",
    checkoutLabel: "Contact sales & upgrade",
    limits: {
      organizations: Infinity,
      workspaces: Infinity,
      members: Infinity,
      projects: null,
      tasksPerMonth: Infinity,
      storageMb: Infinity,
      apiRequestsPerMonth: 2000000,
      automationRunsPerMonth: Infinity,
      teamIntelligenceQueriesPerDay: Infinity,
    },
    features: [
      "sso",
      "audit_logs",
      "custom_roles",
      "advanced_security",
      "dedicated_support",
      "custom_integrations",
      "api_limit_scale",
      "data_retention",
      "enterprise_automation",
      "team_intelligence_full",
    ],
  },
};

// The CUSTOM base entitlement includes every PRO feature.
PLANS.custom.features = [...PLANS.pro.features, "sso", "audit_logs", "custom_roles", "advanced_security", "dedicated_support", "custom_integrations", "api_limit_scale", "data_retention", "enterprise_automation", "team_intelligence_full"];

/**
 * Whether an organization (identified by its plan + purchased add-ons) can use
 * a feature. `addOns` is the array of purchased CUSTOM add-on ids.
 */
export function canAccessFeature(planId, addOns = [], featureKey) {
  if (!planId) return false;
  const feature = FEATURES[featureKey];
  if (!feature) return false;

  const rank = PLAN_RANK[planId];
  if (rank === undefined || rank < 0) return false;

  // FREE plan feature?
  if (feature.minPlan === "free") return true;

  // Pro-tier features are included in PRO and in the CUSTOM base.
  if (feature.minPlan === "pro") {
    return planId === "pro" || planId === "custom";
  }

  // CUSTOM-tier features require the plan AND the purchased add-on.
  if (feature.minPlan === "custom") {
    if (planId !== "custom") return false;
    if (!feature.addon) return true; // e.g. team_intelligence_full
    return Array.isArray(addOns) && addOns.includes(feature.addon);
  }

  return false;
}

/**
 * Resolved limits for an organization. Custom api allowance grows if the
 * `api_limit_scale` add-on is purchased.
 */
export function getPlanLimits(planId, addOns = []) {
  const plan = PLANS[planId] || PLANS.free;
  const limits = { ...plan.limits };
  if (planId === "custom" && Array.isArray(addOns) && addOns.includes("api_limit_scale")) {
    limits.apiRequestsPerMonth = PLANS.custom.limits.apiRequestsPerMonth * 10;
  }
  return limits;
}

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

/** List of feature ids a given plan CANNOT use (for upgrade/awareness UI). */
export function getLockedFeatures(planId, addOns = []) {
  return Object.keys(FEATURES).filter((key) => !canAccessFeature(planId, addOns, key));
}

/** List of feature ids a given plan CAN use. */
export function getAvailableFeatures(planId, addOns = []) {
  return Object.keys(FEATURES).filter((key) => canAccessFeature(planId, addOns, key));
}

/** The cheapest plan that unlocks a feature (for "Available on Pro/Custom" text). */
export function lowestPlanForFeature(featureKey) {
  const feature = FEATURES[featureKey];
  return feature ? feature.minPlan : "custom";
}

/** Planned tiers for the onboarding "what you get vs what you could unlock" view. */
export const ONBOARDING_BREAKDOWN = {
  free: [
    "projects_tasks",
    "kanban_boards",
    "core_rbac",
    "basic_analytics",
    "team_collaboration",
    "basic_integrations",
  ],
  pro: [
    "github_integration",
    "slack_integration",
    "figma_integration",
    "advanced_analytics",
    "organization_2fa",
    "priority_support",
  ],
  custom: ["sso", "custom_roles", "audit_logs", "dedicated_support", "advanced_security"],
};

/** Estimated total for a CUSTOM configuration given selected add-on ids. */
export function computeCustomConfig({ addOns = [], billingCycle = "MONTHLY" } = {}) {
  const addons = addOns.map((id) => CUSTOM_ADDONS[id]).filter(Boolean);
  const addonMonthly = addons.reduce((sum, a) => sum + a.priceMonthly, 0);
  const monthly = CUSTOM_ENTERPRISE_BASE + addonMonthly;
  const annual = annualize(monthly);
  return {
    basePlan: "pro",
    enterpriseBaseFee: CUSTOM_ENTERPRISE_BASE,
    selectedAddOns: addons,
    monthly,
    annual,
    billingCycle,
    pricePerMonth: billingCycle === "ANNUAL" ? Math.round((annual / 12) * 100) / 100 : monthly,
    annualTotal: annual,
  };
}

export default {
  PLAN_ORDER,
  PLAN_RANK,
  PLANS,
  FEATURES,
  CUSTOM_ADDONS,
  CUSTOM_ENTERPRISE_BASE,
  ANNUAL_DISCOUNT,
  canAccessFeature,
  getPlanLimits,
  getPlan,
  getFeatureInfo,
  getAvailableFeatures,
  getLockedFeatures,
  lowestPlanForFeature,
  computeCustomConfig,
  ONBOARDING_BREAKDOWN,
  annualize,
};