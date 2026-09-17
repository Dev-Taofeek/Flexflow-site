"use client";

import { canAccessFeature, getPlanLimits, isDemoOrg } from "@flexflow/plans";
import { useApp } from "@/contexts/AppContext";

/**
 * Plan/entitlement helpers for the current organization. The server is the
 * source of truth for enforcement; this hook mirrors the same shared config so
 * the UI never shows a tool a user can't use.
 */
export function useEntitlements() {
    const { currentOrg } = useApp();
    const planInfo = currentOrg?.planInfo || null;
    const planId = planInfo?.plan || "free";
    const addOns = planInfo?.addOns || [];

    // Until an org is loaded we don't want to flash locked states; treat as
    // open so the real entitlement applies as soon as the org has hydrated.
    const noOrg = !currentOrg;
    const demo = isDemoOrg(currentOrg);
    const can = (feature) => (noOrg ? true : canAccessFeature(planId, addOns, feature, { demo }));
    const limits = demo
        ? { ...getPlanLimits(planId, addOns), teamIntelligenceQueriesPerDay: Infinity }
        : getPlanLimits(planId, addOns);

    return {
        can,
        limits,
        planId,
        planName: planInfo?.planLabel || "Free",
        planInfo,
        addOns,
        isFree: planId === "free",
        isPro: planId === "pro",
        isCustom: planId === "custom",
        subscriptionStatus: planInfo?.subscriptionStatus || null,
        billingCycle: planInfo?.billingCycle || null,
    };
}