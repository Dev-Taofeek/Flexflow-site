"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Banknote, Building2, Check, CheckCircle2, ChevronRight, Copy, CreditCard, Loader2, Lock, ShieldCheck, Sparkles, Upload, X, Zap,
} from "lucide-react";

import { PLANS, CUSTOM_ADDONS, CUSTOM_ENTERPRISE_BASE, annualize } from "@flexflow/plans";
import { apiRequest } from "@/lib/api-client";
import { receiptFileToDataUrl } from "@/lib/image-upload";
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

    // Payment method + bank transfer state
    const [method, setMethod] = useState("card");
    const [transferIntent, setTransferIntent] = useState(null);
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferBeforeSubmit, setTransferBeforeSubmit] = useState(false);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [receiptMime, setReceiptMime] = useState(null);
    const [transferNote, setTransferNote] = useState("");
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [rejectingPaymentId, setRejectingPaymentId] = useState(null);
    const [rejectNote, setRejectNote] = useState("");
    const [reviewLoading, setReviewLoading] = useState(null);

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

    function copyText(value) {
        return async () => {
            try {
                await navigator.clipboard.writeText(value);
                addToast(t("settings.billing.transferCopied"), "success");
            } catch {
                addToast(t("settings.billing.transferCopy"), "error");
            }
        };
    }

    async function startTransfer() {
        if (!orgId || !accessToken) return;
        setTransferLoading(true);
        try {
            const res = await runWithStepUp(({ code }) =>
                apiRequest("/billing/transfer/intent", {
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
            setTransferIntent(res);
            setTransferBeforeSubmit(false);
            setTransferNote("");
            setReceiptPreview(null);
            setReceiptMime(null);
            addToast(t("settings.billing.transferIntentCreated"), "success");
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setTransferLoading(false);
        }
    }

    async function handleReceiptFileChange(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const { dataUrl, mime } = await receiptFileToDataUrl(file);
            if (Math.ceil((dataUrl.length * 3) / 4) > 5 * 1024 * 1024) {
                addToast(t("settings.billing.transferReceiptInvalid"), "error");
                return;
            }
            setReceiptPreview(dataUrl);
            setReceiptMime(mime);
        } catch (err) {
            addToast(t("settings.billing.transferReceiptInvalid"), "error");
        }
    }

    async function submitReceipt() {
        if (!transferIntent?.payment?.id || !receiptPreview) {
            addToast(t("settings.billing.transferUploadHint"), "error");
            return;
        }
        setUploadingReceipt(true);
        try {
            await runWithStepUp(({ code }) =>
                apiRequest("/billing/transfer/receipt", {
                    method: "POST",
                    token: accessToken,
                    headers: code ? { "x-2fa-code": code } : {},
                    body: {
                        paymentId: transferIntent.payment.id,
                        organizationId: orgId,
                        receiptData: receiptPreview,
                        receiptMime,
                        note: transferNote,
                    },
                    toast: false,
                }),
            );
            setTransferIntent(null);
            setReceiptPreview(null);
            setReceiptMime(null);
            setTransferNote("");
            addToast(t("settings.billing.transferSubmitted"), "success");
            await load(orgId);
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setUploadingReceipt(false);
        }
    }

    async function reviewPayment(paymentId, decision) {
        setReviewLoading(paymentId);
        try {
            await runWithStepUp(({ code }) =>
                apiRequest(`/billing/transfer/${paymentId}/review`, {
                    method: "POST",
                    token: accessToken,
                    headers: code ? { "x-2fa-code": code } : {},
                    body: {
                        decision,
                        organizationId: orgId,
                        note: decision === "reject" ? rejectNote : undefined,
                    },
                    toast: false,
                }),
            );
            setRejectingPaymentId(null);
            setRejectNote("");
            addToast(
                decision === "approve" ? t("settings.billing.transferApproved") : t("settings.billing.transferRejected"),
                "success",
            );
            await load(orgId);
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setReviewLoading(null);
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

                <div className="mt-6 space-y-4">
                    <p className="text-sm text-(--text-tertiary)">
                        {targetPlan === "pro"
                            ? isAnnual
                              ? t("settings.billing.proSummaryAnnual", { price: `$${PLANS.pro.priceAnnual}` })
                              : t("settings.billing.proSummaryMonthly", { price: `$${PLANS.pro.priceMonthly}` })
                            : selectedAddOns.length === 1
                              ? t("settings.billing.customSummaryOne", { monthly: `$${customEstimate.monthly}`, annual: `$${customEstimate.annual}`, count: selectedAddOns.length })
                              : t("settings.billing.customSummaryMany", { monthly: `$${customEstimate.monthly}`, annual: `$${customEstimate.annual}`, count: selectedAddOns.length })}
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex items-center rounded-xl border border-(--border) bg-(--bg-sunken) p-1">
                            <button
                                type="button"
                                onClick={() => setMethod("card")}
                                aria-pressed={method === "card"}
                                className={[
                                    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                                    method === "card" ? "bg-brand-600 text-white" : "text-(--text-secondary) hover:text-(--text-primary)",
                                ].join(" ")}
                            >
                                <CreditCard className="h-3.5 w-3.5" />
                                {t("settings.billing.cardShort")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod("transfer")}
                                aria-pressed={method === "transfer"}
                                className={[
                                    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                                    method === "transfer" ? "bg-brand-600 text-white" : "text-(--text-secondary) hover:text-(--text-primary)",
                                ].join(" ")}
                            >
                                <Banknote className="h-3.5 w-3.5" />
                                {t("settings.billing.bankTransferShort") || "Bank transfer"}
                            </button>
                        </div>
                        <p className="max-w-sm text-xs leading-relaxed text-(--text-tertiary)">
                            {method === "card"
                                ? t("settings.billing.cardMethodDescription")
                                : t("settings.billing.transferMethodDescription")}
                        </p>
                    </div>
                    <div className="flex justify-end">
                        {method === "card" ? (
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
                        ) : (
                            <button
                                type="button"
                                onClick={startTransfer}
                                disabled={transferLoading || (targetPlan === "custom" && selectedAddOns.length === 0 && !isCustom)}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
                            >
                                {transferLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                                {transferLoading ? t("settings.common.processing") : t("settings.billing.startBankTransfer")}
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
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

            {/* Bank-transfer payments awaiting action */}
            {(data?.payments || []).filter((p) => p.method === "BANK_TRANSFER").length > 0 && (
                <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
                    <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-brand-500" />
                        <h3 className="text-sm font-semibold text-(--text-primary)">{t("settings.billing.transferPendingTitle")}</h3>
                    </div>
                    <p className="mt-1 text-xs text-(--text-muted)">{t("settings.billing.transferPendingHint")}</p>
                    <div className="mt-5 space-y-3">
                        {(data.payments || [])
                            .filter((p) => p.method === "BANK_TRANSFER")
                            .map((p) => {
                                const amount = ((p.amountMinor || 0) / 100).toLocaleString(locale);
                                const statusKey =
                                    p.status === "UNDER_REVIEW"
                                        ? "settings.billing.statusUnderReview"
                                        : p.status === "APPROVED"
                                          ? "settings.billing.statusApproved"
                                          : p.status === "REJECTED"
                                            ? "settings.billing.statusRejected"
                                            : "settings.billing.statusPending";
                                const isActionable = isOwner && p.status === "UNDER_REVIEW";
                                return (
                                    <div
                                        key={p.id}
                                        className="flex flex-col gap-3 rounded-xl border border-(--border) p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-(--text-primary)">
                                                    {p.plan} · {p.billingCycle}
                                                </span>
                                                <span
                                                    className={[
                                                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                        p.status === "UNDER_REVIEW"
                                                            ? "bg-warning-500/15 text-warning-600"
                                                            : p.status === "APPROVED"
                                                              ? "bg-success-500/15 text-success-600"
                                                              : p.status === "REJECTED"
                                                                ? "bg-danger-500/15 text-danger-600"
                                                                : "bg-(--bg-overlay) text-(--text-muted)",
                                                    ].join(" ")}
                                                >
                                                    {t(statusKey)}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-(--text-muted)">
                                                ₦{amount} · {p.reference} · {p.bankName || ""} {p.accountNumber || ""}
                                                {p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString(locale)}` : ""}
                                            </p>
                                        </div>

                                        {isActionable ? (
                                            <div className="flex flex-col items-end gap-2">
                                                {rejectingPaymentId === p.id ? (
                                                    <div className="flex flex-col items-end gap-2 rounded-lg border border-(--border) bg-(--bg-sunken) p-3">
                                                        <input
                                                            type="text"
                                                            value={rejectNote}
                                                            onChange={(e) => setRejectNote(e.target.value)}
                                                            placeholder={t("settings.billing.rejectReasonPlaceholder")}
                                                            className="w-full rounded-lg border border-(--border) bg-(--bg-elevated) px-3 py-1.5 text-sm text-(--text-primary) outline-none focus:border-brand-500 sm:w-72"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setRejectingPaymentId(null); setRejectNote(""); }}
                                                                disabled={Boolean(reviewLoading)}
                                                                className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary) disabled:opacity-60"
                                                            >
                                                                {t("settings.common.cancel")}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => reviewPayment(p.id, "reject")}
                                                                disabled={Boolean(reviewLoading)}
                                                                className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger-500 disabled:opacity-60"
                                                            >
                                                                {reviewLoading === p.id ? t("settings.common.processing") : t("settings.billing.confirmReject")}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => reviewPayment(p.id, "approve")}
                                                            disabled={Boolean(reviewLoading)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success-500 disabled:opacity-60"
                                                        >
                                                            {reviewLoading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                            {t("settings.billing.approveTransfer")}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setRejectingPaymentId(p.id); setRejectNote(""); }}
                                                            disabled={Boolean(reviewLoading)}
                                                            className="rounded-lg bg-danger-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger-500 disabled:opacity-60"
                                                        >
                                                            {t("settings.billing.rejectTransfer")}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                    </div>
                </section>
            )}

            {loading && <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) h-40 animate-pulse" />}

            {/* Bank-transfer modal */}
            {transferIntent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-(--border) bg-(--bg-elevated) p-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Banknote className="h-4.5 w-4.5 text-brand-500" />
                                <h3 className="text-base font-semibold text-(--text-primary)">{t("settings.billing.transferTitle")}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTransferIntent(null)}
                                className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-sunken) hover:text-(--text-primary)"
                                aria-label="Close"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-(--text-muted)">{t("settings.billing.transferStepsHint")}</p>

                        <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
                            <p className="text-xs text-(--text-muted)">{t("settings.billing.transferAmountLabel")}</p>
                            <p className="mt-0.5 text-2xl font-bold text-(--text-primary)">
                                ₦{((transferIntent.payment.amountMinor || 0) / 100).toLocaleString(locale)}
                            </p>
                        </div>

                        <div className="mt-4 space-y-2.5">
                            {[
                                { label: t("settings.billing.transferBankLabel"), value: transferIntent.bankTransfer?.banks?.join(", ") },
                                { label: t("settings.billing.transferAccountLabel"), value: transferIntent.bankTransfer?.accountName },
                                { label: t("settings.billing.transferAccountNumberLabel"), value: transferIntent.bankTransfer?.accountNumber },
                                { label: t("settings.billing.transferReferenceLabel"), value: transferIntent.payment.reference },
                            ].map((row) => (
                                <div
                                    key={row.label}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[11px] uppercase tracking-wide text-(--text-muted)">{row.label}</p>
                                        <p className="truncate text-sm font-medium text-(--text-primary)">{row.value}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={copyText(row.value)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-(--border) px-2.5 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        {t("settings.billing.transferCopy")}
                                    </button>
                                </div>
                            ))}
                            <p className="px-1 text-[11px] text-(--text-muted)">{t("settings.billing.transferReferenceHint")}</p>
                        </div>

                        <div className="mt-5">
                            <p className="text-sm font-medium text-(--text-primary)">{t("settings.billing.transferUpload")}</p>
                            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--border-strong) bg-(--bg-sunken) px-4 py-6 text-center transition-colors hover:border-brand-500">
                                <Upload className="h-5 w-5 text-(--text-muted)" />
                                <span className="text-xs text-(--text-secondary)">
                                    {receiptPreview ? receiptMime?.includes("pdf") ? "PDF" : "Image" : t("settings.billing.transferUploadHint")}
                                </span>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,application/pdf"
                                    onChange={handleReceiptFileChange}
                                    className="sr-only"
                                />
                            </label>
                            {receiptPreview && !receiptMime?.includes("pdf") && (
                                // eslint-disable-next-line @next/next/no-img-element -- data-URL preview; next/image can't optimize blobs
                                <img
                                    src={receiptPreview}
                                    alt="Receipt preview"
                                    className="mt-2 max-h-36 rounded-lg border border-(--border) object-contain"
                                />
                            )}
                        </div>

                        <div className="mt-4">
                            <p className="text-sm font-medium text-(--text-primary)">{t("settings.billing.transferNote")}</p>
                            <textarea
                                value={transferNote}
                                onChange={(e) => setTransferNote(e.target.value)}
                                placeholder={t("settings.billing.transferNotePlaceholder")}
                                rows={2}
                                className="mt-2 w-full resize-none rounded-lg border border-(--border) bg-(--bg-sunken) px-3 py-2 text-sm text-(--text-primary) outline-none focus:border-brand-500"
                            />
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setTransferIntent(null)}
                                className="rounded-lg border border-(--border) px-4 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                            >
                                {t("settings.common.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={submitReceipt}
                                disabled={uploadingReceipt || !receiptPreview}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
                            >
                                {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                {uploadingReceipt ? t("settings.common.processing") : t("settings.billing.transferSubmit")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}