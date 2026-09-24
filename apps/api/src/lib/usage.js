import { prisma } from "./prisma.js";
import { getOrgEntitlementsById } from "./entitlements.js";

/** YYYY-MM for the given date — the monthly API allowance window. */
export function currentMonth(now = new Date()) {
    return now.toISOString().slice(0, 7);
}

/**
 * Best-effort API usage recording. Never throws — usage accounting must not
 * take down an API call. Returns the month key recorded, or null.
 */
export async function recordApiUsage(organizationId, now = new Date()) {
    if (!organizationId) return null;
    const month = currentMonth(now);
    try {
        await prisma.apiUsage.upsert({
            where: { organizationId_month: { organizationId, month } },
            update: { requestCount: { increment: 1 } },
            create: { organizationId, month, requestCount: 1 },
        });
        return month;
    } catch (error) {
        console.error("[usage] failed to record API usage:", error.message);
        return null;
    }
}

/** Current request count for the org in the active month. */
export async function getApiUsage(organizationId, now = new Date()) {
    const month = currentMonth(now);
    const row = await prisma.apiUsage.findUnique({
        where: { organizationId_month: { organizationId, month } },
    });
    return { month, requestCount: row?.requestCount || 0 };
}

/**
 * True when the org has already met its API allowance for this month.
 * Enforced server-side; the web surfaces the same numbers from usage data.
 */
export async function isApiLimitExceeded(organizationId, now = new Date()) {
    const entitlements = await getOrgEntitlementsById(organizationId);
    const limit = entitlements?.limits?.apiRequestsPerMonth;
    if (!Number.isFinite(limit)) return false;
    const usage = await getApiUsage(organizationId, now);
    return usage.requestCount >= limit;
}

/**
 * Tracks team-intelligence query usage for an org per day. Returns the updated
 * count and whether the query was allowed under the plan's daily allowance.
 */
export async function recordIntelligenceUsage(organizationId, now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    const entitlements = await getOrgEntitlementsById(organizationId);
    const limit = entitlements?.limits?.teamIntelligenceQueriesPerDay;
    if (!Number.isFinite(limit)) {
        // CUSTOM (or unlimited) — record for stats but never block.
        await recordRow();
        return { allowed: true, limit: Infinity, count: 0 };
    }

    const row = await prisma.intelligenceUsage.upsert({
        where: { organizationId_day: { organizationId, day } },
        update: { queryCount: { increment: 1 } },
        create: { organizationId, day, queryCount: 1 },
    });

    return { allowed: row.queryCount <= limit, limit, count: row.queryCount };

    async function recordRow() {
        await prisma.intelligenceUsage.upsert({
            where: { organizationId_day: { organizationId, day } },
            update: { queryCount: { increment: 1 } },
            create: { organizationId, day, queryCount: 1 },
        });
    }
}

/** Today's intelligence query count for an org. */
export async function getIntelligenceUsage(organizationId, now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    const row = await prisma.intelligenceUsage.findUnique({
        where: { organizationId_day: { organizationId, day } },
    });
    return { day, queryCount: row?.queryCount || 0 };
}

/**
 * Counts automation runs for an org in the active month. Best-effort (never
 * throws) — usage accounting must not break a provider webhook. The number of
 * `runs` recorded is the number of automation rule executions applied.
 */
export async function recordAutomationRuns(organizationId, runs = 1, now = new Date()) {
    if (!organizationId || !Number.isFinite(runs) || runs < 1) return null;
    const month = currentMonth(now);
    try {
        await prisma.automationUsage.upsert({
            where: { organizationId_month: { organizationId, month } },
            update: { runCount: { increment: runs } },
            create: { organizationId, month, runCount: runs },
        });
        return month;
    } catch (error) {
        console.error("[usage] failed to record automation runs:", error.message);
        return null;
    }
}

/** Current automation-run count for the org in the active month. */
export async function getAutomationUsage(organizationId, now = new Date()) {
    const month = currentMonth(now);
    const row = await prisma.automationUsage.findUnique({
        where: { organizationId_month: { organizationId, month } },
    });
    return { month, runCount: row?.runCount || 0 };
}

/**
 * True when the org has already consumed its monthly automation-run allowance.
 * CUSTOM without `enterprise_automation` is capped at 5,000 runs/month; buying
 * the add-on removes the cap (Infinity).
 */
export async function isAutomationLimitReached(organizationId, now = new Date()) {
    const entitlements = await getOrgEntitlementsById(organizationId);
    const limit = entitlements?.limits?.automationRunsPerMonth;
    if (!Number.isFinite(limit)) return false;
    const usage = await getAutomationUsage(organizationId, now);
    return usage.runCount >= limit;
}