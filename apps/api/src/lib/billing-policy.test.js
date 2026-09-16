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
} from "./billing-policy.js";

const DAY = 24 * 60 * 60 * 1000;

function org({ plan = "PRO", subscriptionEndAt, billingCycle = "MONTHLY", id = "org_1" }) {
    return { id, plan, subscriptionEndAt: subscriptionEndAt?.toISOString?.() ?? subscriptionEndAt, billingCycle };
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