import { test } from "node:test";
import assert from "node:assert/strict";

import {
    graceDays,
    isPaidPlan,
    isPaidStatus,
    expiryDeadlines,
    isWithinGrace,
    hasExpiredBeyondGrace,
    isExpiringSoon,
    requiredLifecycleTransition,
    expiryWarningDedupeKey,
    assessPlanChange,
    isSubscriptionLive,
} from "./billing-policy.js";

const DAY = 24 * 60 * 60 * 1000;

function org({ plan = "PRO", subscriptionEndAt, billingCycle = "MONTHLY", id = "org_1", customAddOns = [], subscriptionStatus = "ACTIVE" }) {
    return { id, plan, subscriptionEndAt: subscriptionEndAt?.toISOString?.() ?? subscriptionEndAt, billingCycle, customAddOns, subscriptionStatus };
}

test("grace days depend on billing cycle", () => {
    assert.equal(graceDays("MONTHLY"), 1);
    assert.equal(graceDays("ANNUAL"), 3);
    assert.equal(graceDays("WEIRD"), 1);
});

test("isPaidPlan / isPaidStatus classify plans and subscription states", () => {
    assert.equal(isPaidPlan({ plan: "PRO" }), true);
    assert.equal(isPaidPlan({ plan: "CUSTOM" }), true);
    assert.equal(isPaidPlan({ plan: "FREE" }), false);
    assert.equal(isPaidPlan({}), false);
    assert.equal(isPaidStatus("ACTIVE"), true);
    assert.equal(isPaidStatus("PAST_DUE"), true);
    assert.equal(isPaidStatus("CANCELLED"), true);
    assert.equal(isPaidStatus("EXPIRED"), false);
});

test("expiryDeadlines computes end + grace window", () => {
    const end = new Date("2026-01-01T00:00:00Z");
    const d = expiryDeadlines(org({ subscriptionEndAt: end, billingCycle: "ANNUAL" }));
    assert.equal(d.endAt.toISOString(), end.toISOString());
    assert.equal(d.graceEndAt.toISOString(), "2026-01-04T00:00:00.000Z");

    assert.equal(expiryDeadlines(org({ plan: "FREE" })), null);
    assert.equal(expiryDeadlines(org({ subscriptionEndAt: null })), null);
    assert.equal(expiryDeadlines(org({ subscriptionEndAt: "not-a-date" })), null);
});

test("grace window and beyond-grace transitions are exact", () => {
    const end = new Date("2026-01-01T00:00:00Z");
    const base = org({ subscriptionEndAt: end });

    assert.equal(isWithinGrace(base, new Date("2025-12-31T00:00:00Z")), false);
    assert.equal(isWithinGrace(base, new Date("2026-01-01T00:00:00Z")), true);
    assert.equal(isWithinGrace(base, new Date("2026-01-02T00:00:00Z")), true);
    assert.equal(isWithinGrace(base, new Date("2026-01-03T00:00:00Z")), false);

    assert.equal(hasExpiredBeyondGrace(base, new Date("2026-01-03T00:00:00Z")), true);
    assert.equal(hasExpiredBeyondGrace(base, new Date("2026-01-01T12:00:00Z")), false);
    assert.equal(hasExpiredBeyondGrace(org({ plan: "FREE" })), false);
});

test("expiring-soon flags the 7-day window only", () => {
    const end = new Date("2026-01-10T00:00:00Z");
    const base = org({ subscriptionEndAt: end });

    assert.equal(isExpiringSoon(base, 7 * DAY, new Date("2026-01-04T00:00:00Z")), true);
    assert.equal(isExpiringSoon(base, 7 * DAY, new Date("2026-01-02T00:00:00Z")), false);
    assert.equal(isExpiringSoon(base, 7 * DAY, new Date("2026-01-10T00:00:00Z")), false);
});

test("requiredLifecycleTransition picks the right action", () => {
    const end = new Date("2026-01-10T00:00:00Z");
    const base = org({ subscriptionEndAt: end });

    assert.equal(requiredLifecycleTransition(base, new Date("2026-01-04T00:00:00Z")), "warn");
    assert.equal(requiredLifecycleTransition(base, new Date("2026-01-10T12:00:00Z")), "grace");
    assert.equal(requiredLifecycleTransition(base, new Date("2026-01-12T00:00:00Z")), "downgrade");
    assert.equal(requiredLifecycleTransition(base, new Date("2025-12-01T00:00:00Z")), null);
    assert.equal(requiredLifecycleTransition(org({ plan: "FREE" })), null);
    assert.equal(requiredLifecycleTransition(org({ subscriptionEndAt: null })), null);
});

test("expiry warning dedupe key is stable per org + window", () => {
    const end = new Date("2026-01-10T00:00:00Z");
    const a = org({ subscriptionEndAt: end });
    assert.equal(expiryWarningDedupeKey(a), "subscription-expiring-org_1-2026-01-10");
    assert.equal(expiryWarningDedupeKey(org({ plan: "FREE" })), null);
});

// ── Plan-change policy ───────────────────────────────────────────────────────
const future = new Date("2026-05-01T00:00:00Z");
const now = new Date("2026-04-01T00:00:00Z");

test("isSubscriptionLive only true for a live paid window", () => {
    const live = org({ subscriptionEndAt: future });
    assert.equal(isSubscriptionLive(live, now), true);
    assert.equal(isSubscriptionLive(org({ plan: "FREE" }), now), false);
    assert.equal(isSubscriptionLive(org({ subscriptionStatus: "CANCELLED", subscriptionEndAt: new Date("2026-01-01T00:00:00Z") }), now), false);
    assert.equal(isSubscriptionLive(org({ subscriptionEndAt: future, subscriptionStatus: "EXPIRED" }), now), false);
});

test("expired or free orgs may buy any plan/cycle", () => {
    const free = org({ plan: "FREE", subscriptionEndAt: null, subscriptionStatus: "ACTIVE" });
    assert.equal(assessPlanChange(free, { planId: "PRO", billingCycle: "MONTHLY" }, now).allowed, true);
    assert.equal(assessPlanChange(free, { planId: "CUSTOM", billingCycle: "ANNUAL", addOns: ["sso"] }, now).allowed, true);
});

test("pro monthly org can go pro yearly or custom, but not re-buy pro monthly", () => {
    const proMonthly = org({ plan: "PRO", billingCycle: "MONTHLY", subscriptionEndAt: future });
    assert.equal(assessPlanChange(proMonthly, { planId: "PRO", billingCycle: "MONTHLY" }, now).allowed, false);
    assert.equal(assessPlanChange(proMonthly, { planId: "PRO", billingCycle: "ANNUAL" }, now).allowed, true);
    assert.equal(assessPlanChange(proMonthly, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso"] }, now).allowed, true);
    assert.equal(assessPlanChange(proMonthly, { planId: "CUSTOM", billingCycle: "ANNUAL", addOns: ["audit_logs"] }, now).allowed, true);
});

test("pro yearly org cannot re-buy pro yearly or downgrade to monthly", () => {
    const proAnnual = org({ plan: "PRO", billingCycle: "ANNUAL", subscriptionEndAt: future });
    assert.equal(assessPlanChange(proAnnual, { planId: "PRO", billingCycle: "ANNUAL" }, now).allowed, false);
    assert.equal(assessPlanChange(proAnnual, { planId: "PRO", billingCycle: "MONTHLY" }, now).allowed, false);
    assert.equal(assessPlanChange(proAnnual, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso"] }, now).allowed, true);
});

test("custom monthly org can go custom yearly or add remaining add-ons, never re-buy or drop to pro", () => {
    const customMonthly = org({ plan: "CUSTOM", billingCycle: "MONTHLY", subscriptionEndAt: future, customAddOns: ["sso", "audit_logs"] });

    // Re-buying the exact same custom config is refused.
    assert.equal(assessPlanChange(customMonthly, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso", "audit_logs"] }, now).allowed, false);
    // A strict subset of the purchased add-ons is also a re-purchase / downgrade.
    assert.equal(assessPlanChange(customMonthly, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso"] }, now).allowed, false);
    // Dropping to Pro is a plan downgrade.
    assert.equal(assessPlanChange(customMonthly, { planId: "PRO", billingCycle: "MONTHLY" }, now).allowed, false);
    // Paying for the REMAINING features while staying monthly is the sanctioned upgrade.
    assert.equal(assessPlanChange(customMonthly, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso", "audit_logs", "custom_roles"] }, now).allowed, true);
    // Annual upgrade with the same add-ons is allowed.
    assert.equal(assessPlanChange(customMonthly, { planId: "CUSTOM", billingCycle: "ANNUAL", addOns: ["sso", "audit_logs"] }, now).allowed, true);
});

test("custom annual org cannot downgrade to monthly or re-buy identical config", () => {
    const customAnnual = org({ plan: "CUSTOM", billingCycle: "ANNUAL", subscriptionEndAt: future, customAddOns: ["sso"] });
    assert.equal(assessPlanChange(customAnnual, { planId: "CUSTOM", billingCycle: "MONTHLY", addOns: ["sso"] }, now).allowed, false);
    assert.equal(assessPlanChange(customAnnual, { planId: "CUSTOM", billingCycle: "ANNUAL", addOns: ["sso"] }, now).allowed, false);
    assert.equal(assessPlanChange(customAnnual, { planId: "CUSTOM", billingCycle: "ANNUAL", addOns: ["sso", "audit_logs"] }, now).allowed, true);
});