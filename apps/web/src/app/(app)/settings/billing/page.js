"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Building2, Check, ChevronRight, CreditCard, Loader2, Lock, ShieldCheck, Sparkles, Zap,
} from "lucide-react";

import { PLANS, CUSTOM_ADDONS, CUSTOM_ENTERPRISE_BASE, annualize } from "@flexflow/plans";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useToast } from "@/contexts/ToastContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { useRole } from "@/hooks/useRole";
import { useI18n } from "@/i18n";

function statusLabel(status, t) {
    const labels = {
        ACTIVE: t("settings.billing.statusActive"),
        TRIALING: t("settings.billing.statusTrial"),
        PAST_DUE: t("settings.billing.statusPastDue"),
        CANCELLED: t("settings.billing.statusCancelled"),
        EXPIRED: t("settings.billing.statusExpired"),
        PAYMENT_FAILED: t("settings.billing.statusPaymentFailed"),
        INCOMPLETE: t("settings.billing.statusIncomplete"),
    };
    return labels[status] || status;
}

function fmtNumber(value, t, locale) {
    if (!Number.isFinite(value)) return t("settings.common.unlimited");
    return value.toLocaleString(locale);
}

function fmtPrice(value, cycle, t) {
    if (!Number.isFinite(value)) return "—";
    return cycle === "ANNUAL"
        ? `$${Math.round(value / 12)}${t("settings.billing.perMonthEstimated")}`
        : `$${value}${t("settings.billing.perMonthSuffix")}`;
}

/** Monthly price of an org's current plan (Custom includes purchased add-ons). */
function planPrice(planInfo) {
    if (planInfo?.plan === "custom") {
        const addonTotal = (planInfo.addOns || []).reduce(
            (sum, id) => sum + (CUSTOM_ADDONS[id]?.priceMonthly || 0),
            0,
        );
        return CUSTOM_ENTERPRISE_BASE + addonTotal;
    }
    return (PLANS[planInfo?.plan] || PLANS.free)?.priceMonthly || 0;
}

function UsageBar({ label, used, limit, unit, t, locale }) {
    const pct = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-(--text-secondary)">{label}</span>
                <span className="text-(--text-muted)">
                    {fmtNumber(used, t, locale)} {unit}{Number.isFinite(limit) ? ` / ${fmtNumber(limit, t, locale)}` : ""}
                </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-(--bg-overlay)">
                <div
                    className={[
                        "h-full rounded-full transition-all",
                        pct >= 100 ? "bg-danger-500" : pct >= 80 ? "bg-warning-500" : "bg-brand-500",
                    ].join(" ")}
                    style={{ width: `${Number.isFinite(limit) ? pct : 4}%` }}
                />
            </div>
        </div>
    );
}

export default function BillingSettingsPage() {
    const searchParams = useSearchParams();
    const { addToast } = useToast();
    const { t, locale } = useI18n();
    const { runWithStepUp } = useStepUp();
    const { currentOrg, accessToken, refreshOrganizations } = useApp();
    const { isFree, isPro, isCustom, planName, planInfo, limits, can } = useEntitlements();
    const { isOwner } = useRole();

    const orgId = searchParams.get("orgId") || currentOrg?.id;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    // Upgrade builder state
    const [cycle, setCycle] = useState("MONTHLY");
    const [targetPlan, setTargetPlan] = useState("pro");
    const [selectedAddOns, setSelectedAddOns] = useState([]);

    const load = useCallback(async (targetOrgId) => {
        if (!targetOrgId || !accessToken) return;
        setLoading(true);
        try {
            const current = await apiRequest(`/billing/current/${targetOrgId}`, { token: accessToken, toast: false });
            setData(current);
            if (current.planInfo?.billingCycle) setCycle(current.planInfo.billingCycle);
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    }, [accessToken, addToast]);

    useEffect(() => {
        if (orgId) {
            const timer = setTimeout(() => { load(orgId); }, 0);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [orgId, load]);

    const customEstimate = useMemo(() => {
        const addonTotal = selectedAddOns.reduce((sum, id) => sum + (CUSTOM_ADDONS[id]?.priceMonthly || 0), 0);
        const monthly = CUSTOM_ENTERPRISE_BASE + addonTotal;
        return { monthly, annual: annualize(monthly) };
    }, [selectedAddOns]);

    const current = data?.planInfo || planInfo;
    const isAnnual = cycle === "ANNUAL";
    const customPrice = isAnnual ? Math.round(customEstimate.annual / 12) : customEstimate.monthly;

    const canManageBilling = isOwner && !isFree;

    async function startCheckout() {
        if (!orgId || !accessToken) return;
        setCheckoutLoading(true);
        try {
            const res = await runWithStepUp(({ code }) =>
                apiRequest("/billing/checkout", {
                    method: "POST",
                    token: accessToken,
                    headers: code ? { "x-2fa-code": code } : {},
                    body: {
                        organizationId: orgId,
                        plan: targetPlan.toUpperCase(),
                        billingCycle: cycle,
                        addOns: targetPlan === "custom" ? selectedAddOns : [],
                    },
                    toast: false,
                }),
            );
            // Hand off to the provider's hosted checkout. Our own /billing/confirm
            // page is where the mock provider (and real-provider returns) finalize.
            window.location.assign(res.url);
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
            setCheckoutLoading(false);
        }
    }

    async function handleCancel() {
        if (!orgId || !accessToken) return;
        setCancelLoading(true);
        try {
            // The confirmation stays in-page (no hostile window.confirm) and the
            // result arrives as an in-app notification via notifyUser on the API —
            // the success/echo message no longer pops up a toast.
            await apiRequest(`/billing/cancel/${orgId}`, { method: "POST", token: accessToken, toast: false });
            setConfirmCancel(false);
            await refreshOrganizations();
            await load(orgId);
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setCancelLoading(false);
        }
    }

    const currentPlanIsPaid = !isFree;

    return (
        <div className="space-y-6">
            {/* Plan summary */}
            <section className="flex flex-col gap-6 rounded-3xl border border-(--border) bg-(--bg-elevated) p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-(--text-muted)">{t("settings.billing.currentPlan")}</p>
                        <div className="mt-0.5 flex items-center gap-2.5">
                            <h2 className="text-xl font-semibold tracking-tight text-(--text-primary)">
                                {planName} {isCustom ? t("settings.billing.customSuffix") : ""}
                            </h2>
                            <span
                                className={[
                                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                    currentPlanIsPaid && planInfo?.subscriptionStatus === "ACTIVE"
                                        ? "bg-success-500/15 text-success-600"
                                        : "bg-(--bg-overlay) text-(--text-muted)",
                                ].join(" ")}
                            >
                                {planInfo?.subscriptionStatus ? statusLabel(planInfo.subscriptionStatus, t) : t("settings.billing.statusActive")}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-(--text-secondary)">
                            {isFree
                                ? t("settings.billing.freePlanDescription")
                                : <>{fmtPrice(isAnnual ? annualize(planPrice(planInfo)) / 12 : planPrice(planInfo), cycle, t)} · {isAnnual ? t("settings.billing.billedAnnually") : t("settings.billing.billedMonthly")}{planInfo?.subscriptionEndAt ? ` · ${t("settings.billing.renewsOn", { date: new Date(planInfo.subscriptionEndAt).toLocaleDateString(locale) })}` : ""}</>}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {canManageBilling &&
                        (confirmCancel ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-500/30 bg-danger-500/5 px-4 py-2.5">
                                <p className="text-sm text-(--text-secondary)">{t("settings.billing.cancelConfirm")}</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={cancelLoading}
                                        className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger-500 disabled:opacity-60"
                                    >
                                        {cancelLoading ? t("settings.common.processing") : t("settings.billing.cancelSubscription")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmCancel(false)}
                                        disabled={cancelLoading}
                                        className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary) disabled:opacity-60"
                                    >
                                        {t("settings.common.cancel")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmCancel(true)}
                                className="rounded-lg border border-(--border) px-4 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:border-(--border-strong) hover:text-(--text-primary)"
                            >
                                {t("settings.billing.cancelSubscription")}
                            </button>
                        ))}
                </div>
            </section>

            {/* Usage meters */}
            <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
                <h3 className="text-sm font-semibold text-(--text-primary)">{t("settings.billing.usageAndLimits")}</h3>
                <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <UsageBar
                        label={t("settings.common.apiRequestsMonth")}
                        used={data?.usage?.apiUsage?.requestCount || 0}
                        limit={limits.apiRequestsPerMonth}
                        unit="req"
                        t={t}
                        locale={locale}
                    />
                    <UsageBar
                        label={t("settings.common.intelligenceQueriesToday")}
                        used={data?.usage?.intelligenceUsage?.queryCount || 0}
                        limit={limits.teamIntelligenceQueriesPerDay}
                        unit="query"
                        t={t}
                        locale={locale}
                    />
                    <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl border border-(--border) p-3">
                            <p className="text-xs text-(--text-muted)">{t("settings.common.organizations")}</p>
                            <p className="mt-1 text-lg font-semibold text-(--text-primary)">{fmtNumber(limits.organizations, t, locale)}</p>
                        </div>
                        <div className="rounded-xl border border-(--border) p-3">
                            <p className="text-xs text-(--text-muted)">{t("settings.common.workspaces")}</p>
                            <p className="mt-1 text-lg font-semibold text-(--text-primary)">{fmtNumber(limits.workspaces, t, locale)}</p>
                        </div>
                        <div className="rounded-xl border border-(--border) p-3">
                            <p className="text-xs text-(--text-muted)">{t("settings.common.members")}</p>
                            <p className="mt-1 text-lg font-semibold text-(--text-primary)">{fmtNumber(limits.members, t, locale)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Upgrade builder */}
            <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-(--text-primary)">{t("settings.billing.upgradeTitle")}</h3>
                        <p className="mt-1 text-sm text-(--text-secondary)">
                            {t("settings.billing.upgradeDescription", { name: currentOrg?.name || t("settings.billing.thisOrganization") })}
                        </p>
                    </div>
                    <div className="inline-flex items-center rounded-xl border border-(--border) bg-(--bg-sunken) p-1">
                        {["MONTHLY", "ANNUAL"].map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setCycle(option)}
                                aria-pressed={cycle === option}
                                className={[
                                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                                    cycle === option ? "bg-brand-600 text-white" : "text-(--text-secondary) hover:text-(--text-primary)",
                                ].join(" ")}
                            >
                                {option === "MONTHLY" ? t("settings.billing.cycleMonthly") : t("settings.billing.cycleAnnual")}
                                {option === "ANNUAL" && <span className="ml-1 text-[10px] opacity-80">-30%</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {isFree && data?.firstMonthFreeEligible ? (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        <div>
                            <p className="text-sm font-medium text-(--text-primary)">{t("settings.billing.firstMonthFree")}</p>
                            <p className="mt-0.5 text-xs text-(--text-muted)">{t("settings.billing.firstMonthFreeDescription")}</p>
                        </div>
                    </div>
                ) : null}
                {!isFree ? (
                    <p className="mt-5 rounded-xl border border-(--border) bg-(--bg-sunken) px-4 py-3 text-xs leading-relaxed text-(--text-muted)">
                        {t("settings.billing.upgradeOnlyNote")}
                    </p>
                ) : null}

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {/* Pro card */}
                    <button
                        type="button"
                        onClick={() => setTargetPlan("pro")}
                        aria-pressed={targetPlan === "pro"}
                        className={[
                            "rounded-2xl border p-5 text-left transition-colors",
                            targetPlan === "pro"
                                ? "border-brand-500/60 bg-brand-500/5"
                                : "border-(--border) hover:border-(--border-strong)",
                        ].join(" ")}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Zap className="h-4.5 w-4.5 text-brand-500" />
                                <h4 className="text-base font-semibold text-(--text-primary)">{t("settings.common.planPro")}</h4>
                            </div>
                            {isPro && (
                                <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">
                                    {t("settings.common.current")}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                            {t("settings.billing.proPlanDescription")}
                        </p>
                        <div className="mt-4 flex items-end gap-1.5">
                            <span className="text-2xl font-bold text-(--text-primary)">
                                ${isAnnual ? Math.round(PLANS.pro.priceAnnual / 12) : PLANS.pro.priceMonthly}
                            </span>
                            <span className="pb-0.5 text-xs text-(--text-tertiary)">{t("settings.billing.perMonthSuffix")} · {isAnnual ? t("settings.billing.billedAnnually") : t("settings.billing.billedMonthly")}</span>
                        </div>
                    </button>

                    {/* Custom card */}
                    <button
                        type="button"
                        onClick={() => setTargetPlan("custom")}
                        aria-pressed={targetPlan === "custom"}
                        className={[
                            "rounded-2xl border p-5 text-left transition-colors",
                            targetPlan === "custom"
                                ? "border-brand-500/60 bg-brand-500/5"
                                : "border-(--border) hover:border-(--border-strong)",
                        ].join(" ")}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Building2 className="h-4.5 w-4.5 text-brand-500" />
                                <h4 className="text-base font-semibold text-(--text-primary)">{t("settings.common.planCustom")}</h4>
                            </div>
                            {isCustom && (
                                <span className="rounded-full border border-brand-500/40 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">
                                    {t("settings.common.current")}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                            {t("settings.billing.customPlanDescription")}
                        </p>
                        <div className="mt-4 flex items-end gap-1.5">
                            <span className="text-2xl font-bold text-(--text-primary)">${customPrice}</span>
                            <span className="pb-0.5 text-xs text-(--text-tertiary)">{t("settings.billing.perMonthEstShort")}</span>
                        </div>
                    </button>
                </div>

                {targetPlan === "custom" && (
                    <div className="mt-5 rounded-2xl border border-(--border) p-5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-(--text-primary)">{t("settings.billing.enterpriseAddOns")}</h4>
                            <p className="text-xs text-(--text-tertiary)">{t("settings.billing.selectAddOnsHint")}</p>
                        </div>
                        <div className="mt-4 grid gap-2.5 md:grid-cols-2">
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
                                            selected ? "border-brand-500/50 bg-brand-500/5" : "border-(--border) hover:border-(--border-strong)",
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
                                                {addon.name}
                                                <span className="text-xs text-(--text-tertiary)">+{addon.priceMonthly}{t("settings.billing.perMonthSuffix")}</span>
                                            </span>
                                            <span className="mt-0.5 block text-xs leading-relaxed text-(--text-muted)">
                                                {addon.description}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <p className="text-sm text-(--text-tertiary)">
                        {targetPlan === "pro"
                            ? isAnnual
                              ? t("settings.billing.proSummaryAnnual", { price: `$${PLANS.pro.priceAnnual}` })
                              : t("settings.billing.proSummaryMonthly", { price: `$${PLANS.pro.priceMonthly}` })
                            : selectedAddOns.length === 1
                              ? t("settings.billing.customSummaryOne", { monthly: `$${customEstimate.monthly}`, annual: `$${customEstimate.annual}`, count: selectedAddOns.length })
                              : t("settings.billing.customSummaryMany", { monthly: `$${customEstimate.monthly}`, annual: `$${customEstimate.annual}`, count: selectedAddOns.length })}
                    </p>
                    <button
                        type="button"
                        onClick={startCheckout}
                        disabled={checkoutLoading || (targetPlan === "custom" && selectedAddOns.length === 0 && !isCustom)}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
                    >
                        {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        {checkoutLoading ? t("settings.common.redirecting") : isFree && targetPlan === "pro"
                            ? t("settings.billing.upgradeToPro", { price: `$${isAnnual ? Math.round(PLANS.pro.priceAnnual / 12) : PLANS.pro.priceMonthly}` })
                            : t("settings.billing.upgradeNow")}
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </section>

            {/* Entitlement notes */}
            <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
                        <ShieldCheck className="h-4 w-4 text-success-500" />
                        {t("settings.billing.includedWithPlan")}
                    </div>
                    <ul className="mt-3 space-y-2">
                        {(isCustom
                            ? [
                                t("settings.billing.featureSSO"),
                                t("settings.billing.featureWorkspaceIsolation"),
                                t("settings.billing.featureTeamIntelligenceFull"),
                                t("settings.billing.featureEnterpriseSupport"),
                                t("settings.billing.featureConfigurableAddOns"),
                              ]
                            : isPro
                              ? [
                                t("settings.billing.featureAdvancedRBAC"),
                                t("settings.billing.featureAdvancedAnalytics"),
                                t("settings.billing.featureGitHubSlack"),
                                t("settings.billing.featureOrg2FA"),
                                t("settings.billing.featureIntelligenceQueries"),
                              ]
                              : [
                                t("settings.billing.featureKanban"),
                                t("settings.billing.featureBasicRBAC"),
                                t("settings.billing.featureRealtimeCollaboration"),
                                t("settings.billing.featureCommunitySupport"),
                              ]
                        ).map((line) => (
                            <li key={line} className="flex items-center gap-2.5 text-sm text-(--text-secondary)">
                                <Check className="h-3.5 w-3.5 text-success-500" /> {line}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
                        <Lock className="h-4 w-4 text-brand-500" />
                        {t("settings.billing.upgradeExplainTitle")}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-(--text-secondary)">
                        {t("settings.billing.upgradeExplainDescription")}
                    </p>
                    {isFree && (
                        <Link
                            href="/pricing"
                            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
                        >
                            {t("settings.billing.comparePlans")} <ChevronRight className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </section>

            {loading && <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) h-40 animate-pulse" />}
        </div>
    );
}