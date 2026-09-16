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