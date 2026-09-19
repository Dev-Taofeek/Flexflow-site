"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Building2,
    CheckCircle2,
    CircleAlert,
    Loader2,
    Lock,
    ShieldCheck,
    Zap,
} from "lucide-react";

import { PLANS, CUSTOM_ADDONS, CUSTOM_ENTERPRISE_BASE, annualize } from "@flexflow/plans";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { useI18n } from "@/i18n";

/**
 * Checkout page. This is where the money actually changes hands:
 *  - mock: the user completes a payment step (enters card details), then the
 *    API activates the plan and records a `payment.succeeded` billing event.
 *    No more "click upgrade → instantly granted for free".
 *  - stripe / paystack: the user already paid in the provider's hosted UI; we
 *    acknowledge here and the signed webhook finalizes the subscription.
 */
export default function BillingConfirmPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                </div>
            }
        >
            <BillingConfirmContent />
        </Suspense>
    );
}

function LoadingScreen({ realProvider }) {
    const { t } = useI18n();
    return (
        <div className="flex flex-col items-center py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <h1 className="mt-5 text-xl font-semibold text-(--text-primary)">
                {t("settings.billing.confirmTitle")}
            </h1>
            <p className="mt-2 text-sm text-(--text-secondary)">
                {realProvider ? t("settings.billing.confirmProviderNote") : t("settings.billing.paymentLoading")}
            </p>
        </div>
    );
}

function DoneScreen({ waiting, firstMonthFree, billingHref }) {
    const { t } = useI18n();
    return (
        <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
                <CheckCircle2 className="h-6 w-6 text-success-500" />
            </div>
            <h1 className="mt-5 text-xl font-semibold text-(--text-primary)">
                {t("settings.billing.confirmTitle")}
            </h1>
            <p className="mt-2 text-sm text-(--text-secondary)">
                {waiting ? t("settings.billing.confirmProviderNote") : t("settings.billing.confirmSuccess")}
            </p>
            {firstMonthFree ? (
                <p className="mt-2 rounded-full bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-600">
                    {t("settings.billing.firstMonthFreeApplied")}
                </p>
            ) : null}
            <Link
                href={billingHref}
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
                {t("settings.billing.confirmBack")}
            </Link>
        </div>
    );
}

function BillingConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { accessToken, refreshOrganizations, currentOrg } = useApp();
    const { t } = useI18n();
    const { runWithStepUp } = useStepUp();

    const orgId = searchParams.get("orgId") || searchParams.get("org");
    const provider = searchParams.get("provider") || "mock";
    const planParam = searchParams.get("plan") || "pro";
    const billingCycle = searchParams.get("billingCycle") || "MONTHLY";

    const addOns = useMemo(() => {
        try {
            return JSON.parse(searchParams.get("addOns") || "[]");
        } catch {
            return [];
        }
    }, [searchParams]);

    // paymentOutcome mirrors the mock payment step only; the rest of the screen
    // is derived from search params + hydration state, so no effect-driven setState.
    const [paymentOutcome, setPaymentOutcome] = useState(null); // null | "paying" | "done" | "error"
    const [message, setMessage] = useState("");
    const [firstMonthFree, setFirstMonthFree] = useState(false);
    const [card, setCard] = useState({ holder: "", number: "", expiry: "", cvc: "" });

    // Refresh org cache once the URL is live so a pending webhook-based plan
    // change (real providers) is reflected in the rest of the app. No direct
    // setState here — async external refresh only.
    const refreshed = useRef(false);
    useEffect(() => {
        if (accessToken && provider !== "mock" && !refreshed.current) {
            refreshed.current = true;
            refreshOrganizations().then(() => {}, () => {});
        }
    }, [accessToken, provider, refreshOrganizations]);

    const isAnnual = billingCycle === "ANNUAL";
    const price = useMemo(() => {
        if (planParam === "custom") {
            const addonTotal = addOns.reduce((sum, id) => sum + (CUSTOM_ADDONS[id]?.priceMonthly || 0), 0);
            const monthly = CUSTOM_ENTERPRISE_BASE + addonTotal;
            return isAnnual ? Math.round(annualize(monthly) / 12) : monthly;
        }
        return isAnnual ? Math.round(PLANS.pro.priceAnnual / 12) : PLANS.pro.priceMonthly;
    }, [planParam, addOns, isAnnual]);
    const planName = planParam === "custom" ? `${PLANS.custom.name} add-ons` : PLANS.pro.name;

    const cardValid =
        /^\d{12,19}$/.test(card.number.replace(/\s/g, "")) &&
        /^(0[1-9]|1[0-2])\s?\/\s?\d{2}$/.test(card.expiry.trim()) &&
        /^\d{3,4}$/.test(card.cvc.trim()) &&
        card.holder.trim().length >= 2;

    async function confirmPayment() {
        if (paymentOutcome === "paying") return;
        if (!orgId) {
            setMessage(t("settings.billing.confirmErrorInvalidParams"));
            setPaymentOutcome("error");
            return;
        }
        if (!cardValid) {
            setMessage(t("settings.billing.paymentInvalid"));
            setPaymentOutcome("error");
            return;
        }
        setPaymentOutcome("paying");
        setMessage("");
        try {
            const sessionIdParam = searchParams.get("session_id");
            if (!sessionIdParam) {
                throw new Error(t("settings.billing.confirmErrorInvalidParams"));
            }
            const result = await runWithStepUp(({ code }) =>
                apiRequest("/billing/confirm", {
                    method: "POST",
                    token: accessToken,
                    toast: false,
                    headers: code ? { "x-2fa-code": code } : {},
                    body: {
                        sessionId: sessionIdParam,
                        organizationId: orgId,
                        plan: planParam,
                        billingCycle,
                        addOns,
                        paymentConfirmed: true,
                        paymentToken: `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                        cardLast4: card.number.replace(/\D/g, "").slice(-4),
                    },
                }),
            );
            if (result?.firstMonthFree) setFirstMonthFree(true);
            if (!refreshed.current) {
                refreshed.current = true;
                refreshOrganizations().then(() => {}, () => {});
            }
            setPaymentOutcome("done");
            const target = `/settings/billing${orgId ? `?orgId=${orgId}` : ""}`;
            setTimeout(() => router.replace(target), 1500);
        } catch (err) {
            setPaymentOutcome("error");
            setMessage(err.message || t("settings.billing.confirmError"));
        }
    }

    const billingHref = `/settings/billing${orgId ? `?orgId=${orgId}` : ""}`;
    const inputCls =
        "w-full rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-brand-500/60 focus:outline-none";

    const realProvider = provider !== "mock";
    const ready = Boolean(accessToken);

    return (
        <div className="mx-auto max-w-xl py-10">
            {!ready ? (
                <LoadingScreen realProvider={realProvider} />
            ) : realProvider ? (
                <DoneScreen waiting billingHref={billingHref} firstMonthFree={firstMonthFree} />
            ) : paymentOutcome === "paying" ? (
                <LoadingScreen realProvider={false} />
            ) : paymentOutcome === "done" ? (
                <DoneScreen waiting={false} billingHref={billingHref} firstMonthFree={firstMonthFree} />
            ) : paymentOutcome === "error" ? (
                <div className="flex flex-col items-center py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-500/15 text-danger-500">
                        <CircleAlert className="h-6 w-6" />
                    </div>
                    <h1 className="mt-5 text-xl font-semibold text-(--text-primary)">
                        {t("settings.billing.paymentFailedTitle")}
                    </h1>
                    <p className="mt-2 text-sm text-(--text-secondary)">{message}</p>
                    <Link
                        href={billingHref}
                        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                    >
                        {t("settings.billing.confirmBack")}
                    </Link>
                </div>
            ) : (
                <div className="overflow-hidden rounded-3xl border border-(--border) bg-(--bg-elevated)">
                    {/* Order summary */}
                    <div className="border-b border-(--border) bg-(--bg-sunken)/60 p-6">
                        <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">
                            {t("settings.billing.orderSummary")}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                                    {planParam === "custom" ? <Building2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-(--text-primary)">{planName}</p>
                                    <p className="text-xs text-(--text-muted)">
                                        {isAnnual ? t("settings.billing.billedAnnually") : t("settings.billing.billedMonthly")}
                                        {addOns.length > 0 ? ` · ${addOns.length} ${t("settings.billing.addOnsCount")}` : ""}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-(--text-primary)">
                                ${price}
                                <span className="text-sm font-normal text-(--text-muted)">{t("settings.billing.perMonthSuffix")}</span>
                            </p>
                        </div>
                    </div>

                    {/* Payment form */}
                    <form
                        className="space-y-4 p-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            confirmPayment();
                        }}
                    >
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                                {t("settings.billing.cardHolder")}
                            </label>
                            <input
                                value={card.holder}
                                onChange={(e) => setCard((c) => ({ ...c, holder: e.target.value }))}
                                placeholder={t("settings.billing.cardHolderPlaceholder")}
                                autoComplete="cc-name"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                                {t("settings.billing.cardNumber")}
                            </label>
                            <input
                                value={card.number}
                                onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                                placeholder={t("settings.billing.cardNumberPlaceholder")}
                                inputMode="numeric"
                                autoComplete="cc-number"
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                                    {t("settings.billing.cardExpiry")}
                                </label>
                                <input
                                    value={card.expiry}
                                    onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                                    placeholder={t("settings.billing.cardExpiryPlaceholder")}
                                    inputMode="numeric"
                                    autoComplete="cc-exp"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
                                    {t("settings.billing.cardCvc")}
                                </label>
                                <input
                                    value={card.cvc}
                                    onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                                    placeholder={t("settings.billing.cardCvcPlaceholder")}
                                    inputMode="numeric"
                                    autoComplete="cc-csc"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-xs text-(--text-muted)">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-success-500" />
                            {t("settings.billing.mockPaymentNote")}
                        </div>

                        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <Link
                                href={billingHref}
                                className="text-sm font-medium text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
                            >
                                {t("settings.billing.paymentBack")}
                            </Link>
                            <button
                                type="submit"
                                disabled={!cardValid}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Lock className="h-4 w-4" />
                                {t("settings.billing.payNow", { price: `$${price}` })}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}