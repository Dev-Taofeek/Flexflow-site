// Pure, deterministic billing lifecycle policy — no I/O so it can be unit
// tested directly. All date math stays here; the sweeper in billing.service
// applies the transitions this module decides.

const DAY_MS = 24 * 60 * 60 * 1000;

export const GRACE_DAYS = { MONTHLY: 1, ANNUAL: 3 };

const PAID_PLANS = new Set(["PRO", "CUSTOM"]);

// Statuses that imply a live paid subscription.
const PAID_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE", "PAYMENT_FAILED", "CANCELLED"]);

export function graceDays(billingCycle) {
    return billingCycle === "ANNUAL" ? GRACE_DAYS.ANNUAL : GRACE_DAYS.MONTHLY;
}

export function isPaidPlan(org) {
    return PAID_PLANS.has(org?.plan);
}

export function isPaidStatus(status) {
    return PAID_STATUSES.has(status);
}

/** Absolute end + grace timelines for a paid org, or null when unsubscribed. */
export function expiryDeadlines(org) {
    if (!isPaidPlan(org)) return null;
    const endAt = org?.subscriptionEndAt ? new Date(org.subscriptionEndAt) : null;
    if (!endAt || Number.isNaN(endAt.getTime())) return null;
    const graceEndAt = new Date(endAt.getTime() + graceDays(org?.billingCycle) * DAY_MS);
    return { endAt, graceEndAt };
}

/** True when the paid window elapsed but the grace period still covers `now`. */
export function isWithinGrace(org, now = new Date()) {
    const d = expiryDeadlines(org);
    if (!d) return false;
    return d.endAt <= now && now <= d.graceEndAt;
}

/** True once both the paid window and the grace period are history. */
export function hasExpiredBeyondGrace(org, now = new Date()) {
    const d = expiryDeadlines(org);
    return Boolean(d && now > d.graceEndAt);
}

/** True when the paid window ends within `windowMs` from `now`. */
export function isExpiringSoon(org, windowMs = 7 * DAY_MS, now = new Date()) {
    const d = expiryDeadlines(org);
    return Boolean(d && d.endAt > now && d.endAt <= new Date(now.getTime() + windowMs));
}

/**
 * Decides the required lifecycle transition for an org at `now`.
 * Returns one of:
 *  - "downgrade" — plan must be dropped back to FREE (grace already elapsed),
 *  - "grace"     — paid window elapsed but we're still inside grace (→ PAST_DUE),
 *  - "warn"      — within 7 days of expiry (→ idempotent warning notification),
 *  - null        — nothing to do.
 */
export function requiredLifecycleTransition(org, now = new Date()) {
    if (!isPaidPlan(org)) return null;

    const d = expiryDeadlines(org);
    if (!d) return null;

    if (now > d.graceEndAt) return "downgrade";
    if (now > d.endAt) return "grace";
    if (isExpiringSoon(org, 7 * DAY_MS, now)) return "warn";
    return null;
}

/** Stable dedupe key for the 7-day expiry warning (per org per billing window). */
export function expiryWarningDedupeKey(org) {
    const d = expiryDeadlines(org);
    if (!d) return null;
    return `subscription-expiring-${org?.id}-${d.endAt.toISOString().slice(0, 10)}`;
}

// ── Plan-change policy ───────────────────────────────────────────────────────
// Ranked so changes can be classified as upgrades (allowed), lateral/renewals,
// or downgrades (refused while a paid subscription is live).
const PLAN_RANK = { free: 0, pro: 1, custom: 2 };
const CYCLE_RANK = { MONTHLY: 0, ANNUAL: 1 };

function normalizePlan(plan) {
    const value = String(plan || "").toUpperCase();
    if (value === "CUSTOM") return "custom";
    if (value === "PRO") return "pro";
    return "free";
}

function normalizeCycle(cycle) {
    return String(cycle || "").toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

function normalizeAddOns(addOns) {
    if (!Array.isArray(addOns)) return [];
    return [...new Set(addOns.map((a) => String(a).toLowerCase()).filter(Boolean))];
}

/** True when the org currently holds a live, unexpired paid subscription. */
export function isSubscriptionLive(org, now = new Date()) {
    if (!isPaidPlan(org)) return false;
    if (!isPaidStatus(org?.subscriptionStatus)) return false;
    const endAt = org?.subscriptionEndAt ? new Date(org.subscriptionEndAt) : null;
    return Boolean(endAt && endAt.getTime() > now.getTime());
}

/**
 * Classifies a requested plan/cycle/add-on change against the org's current
 * state. Returns `{ allowed, code }`. While a paid subscription is live:
 *  - lower plan rank → refused (no downgrades),
 *  - same plan, annual → monthly → refused,
 *  - same plan + same cycle (re-purchasing what is already active) → refused;
 *    for CUSTOM the same config (or a strict subset of purchased add-ons) is
 *    treated as a re-purchase — buying ADDITIONAL add-ons on the monthly cycle
 *    is the sanctioned "stay monthly, pay for the remaining features" upgrade,
 *  - everything else (upgrades, monthly → annual, custom with new add-ons)
 *    allowed.
 */
export function assessPlanChange(org, { planId, billingCycle, addOns = [] } = {}, now = new Date()) {
    if (!isSubscriptionLive(org, now)) return { allowed: true, code: null };

    const targetPlan = normalizePlan(planId);
    const currentPlan = normalizePlan(org?.plan);
    const targetCycle = normalizeCycle(billingCycle);
    const currentCycle = normalizeCycle(org?.billingCycle);
    const targetAddOns = normalizeAddOns(addOns);
    const currentAddOns = normalizeAddOns(org?.customAddOns);

    // Downgrading to a lower-ranked plan is never allowed while live.
    if (PLAN_RANK[targetPlan] < PLAN_RANK[currentPlan]) {
        return { allowed: false, code: "PLAN_DOWNGRADE_NOT_ALLOWED" };
    }

    if (PLAN_RANK[targetPlan] === PLAN_RANK[currentPlan]) {
        // Annual → monthly on the same plan is a cycle downgrade.
        if (CYCLE_RANK[targetCycle] < CYCLE_RANK[currentCycle]) {
            return { allowed: false, code: "CYCLE_DOWNGRADE_NOT_ALLOWED" };
        }

        if (targetCycle === currentCycle) {
            if (targetPlan === "custom") {
                // Same custom config or a subset of the purchased add-ons is a
                // re-purchase. Purchasing NEW add-ons (the "complete the plan"
                // monthly upgrade) is allowed.
                const addsNewAddOns = targetAddOns.some((a) => !currentAddOns.includes(a));
                if (!addsNewAddOns) {
                    return { allowed: false, code: "SAME_PLAN_REPURCHASE_NOT_ALLOWED" };
                }
                return { allowed: true, code: null };
            }
            // Same Pro plan + same cycle is a re-purchase of an active plan.
            return { allowed: false, code: "SAME_PLAN_REPURCHASE_NOT_ALLOWED" };
        }
    }

    return { allowed: true, code: null };
}

/**
 * Whether the org has never completed a paid checkout before — used to grant
 * the one-time "first month free" bonus. Derived from billing events so it
 * survives a later downgrade (which keeps the historical event).
 */
export async function hasUsedFirstMonthFree(prismaClient, organizationId) {
    const priorPaid = await prismaClient.billingEvent.count({
        where: {
            organizationId,
            eventType: { in: ["checkout.completed", "subscription.activated"] },
        },
    });
    return priorPaid > 0;
}