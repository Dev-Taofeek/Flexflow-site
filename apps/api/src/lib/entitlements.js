import { canAccessFeature, getPlanLimits, isDemoOrg, FEATURES } from "@flexflow/plans";
import { prisma } from "./prisma.js";
import { errorResponse } from "../utils/api-response.js";

// Maps the Prisma enum values on Organization.plan to the canonical plan ids
// used across the shared @flexflow/plans package.
export const PLAN_FIELD_MAP = { FREE: "free", PRO: "pro", CUSTOM: "custom" };

/**
 * The effective plan of an organization. Subscription status is the source of
 * truth: a paid plan only counts while the status is active/trialing/past-due,
 * or cancelled but still within the paid-through window. Otherwise the org
 * degrades back to FREE so paid features are never awarded by accident.
 */
export function effectivePlanId(org) {
    const base = PLAN_FIELD_MAP[org?.plan] || "free";
    if (base === "free") return "free";

    const status = org?.subscriptionStatus;
    if (status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE") return base;
    if (status === "CANCELLED" && org?.subscriptionEndAt && new Date(org.subscriptionEndAt) > new Date()) {
        return base;
    }
    return "free";
}

/** Lower-cased, de-duplicated list of purchased CUSTOM add-on ids. */
export function normalizeAddOns(org) {
    if (!Array.isArray(org?.customAddOns)) return [];
    return [...new Set(org.customAddOns.map((a) => String(a).toLowerCase()))];
}

/** Resolve plan + limits for an organization row. */
export function getOrgEntitlements(org) {
    const planId = effectivePlanId(org);
    const addOns = normalizeAddOns(org);
    const demo = isDemoOrg(org);
    const limits = demo
        ? { ...getPlanLimits(planId, addOns), teamIntelligenceQueriesPerDay: Infinity }
        : getPlanLimits(planId, addOns);
    return {
        planId,
        addOns,
        limits,
        demo,
    };
}

export async function getOrgEntitlementsById(organizationId) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true, plan: true, subscriptionStatus: true, subscriptionEndAt: true, customAddOns: true },
    });
    return org ? getOrgEntitlements(org) : null;
}

/** Serialized plan info attached to org responses so the UI stays consistent. */
export function planInfoForOrg(org) {
    const { planId, addOns } = getOrgEntitlements(org);
    return {
        plan: planId,
        planLabel: planId === "custom" ? "Custom" : planId === "pro" ? "Pro" : "Free",
        addOns,
        billingCycle: org?.billingCycle,
        subscriptionStatus: org?.subscriptionStatus,
        subscriptionStartAt: org?.subscriptionStartAt,
        subscriptionEndAt: org?.subscriptionEndAt,
    };
}

/** Returns a consistent "upgrade required" response body. */
export function planBlockedResponse(res, feature, planId, addOns = []) {
    const featureInfo = FEATURES[feature];
    return res.status(403).json({
        ...errorResponse("PLAN_REQUIRED", featureInfo?.name ? `"${featureInfo.name}" requires an upgrade.` : "This feature requires an upgrade."),
        data: {
            code: "PLAN_REQUIRED",
            feature,
            featureName: featureInfo?.name || feature,
            planId,
            addOns,
            upgradeAvailable: true,
        },
    });
}

/**
 * Enforces that an org can use `feature`. Responds with a plan-blocked error
 * when not. Returns `true` (with the entitlements attached to req) on success.
 */
export async function enforceFeature(req, res, organizationId, feature) {
    const entitlements = await getOrgEntitlementsById(organizationId);
    if (!entitlements) {
        if (!res.headersSent) res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));
        return null;
    }
    if (!canAccessFeature(entitlements.planId, entitlements.addOns, feature, { demo: entitlements.demo })) {
        if (!res.headersSent) planBlockedResponse(res, feature, entitlements.planId, entitlements.addOns);
        return null;
    }
    req.orgEntitlements = entitlements;
    return entitlements;
}

/**
 * Enforces a numeric limit for an org (from PLAN limits). `currentCount`
 * should already include what this request would add. Responds 403 with an
 * upgrade hint when exceeded.
 */
export async function enforceMinLimit(req, res, organizationId, limitKey, currentCount) {
    const entitlements = await getOrgEntitlementsById(organizationId);
    if (!entitlements) {
        if (!res.headersSent) res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));
        return null;
    }
    const limit = entitlements.limits?.[limitKey];
    if (Number.isFinite(limit) && currentCount > limit) {
        if (!res.headersSent) {
            res.status(403).json({
                ...errorResponse("LIMIT_REACHED", `You have reached the ${limitKey.replace(/([A-Z])/g, " $1").toLowerCase()} limit for your plan.`),
                data: { code: "LIMIT_REACHED", limitKey, limit, current: currentCount, planId: entitlements.planId, upgradeAvailable: true },
            });
        }
        return null;
    }
    req.orgEntitlements = entitlements;
    return entitlements;
}

export { canAccessFeature };