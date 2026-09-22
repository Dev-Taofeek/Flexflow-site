"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, CircleAlert, Loader2, ShieldCheck } from "lucide-react";

import { PLANS, CUSTOM_ADDONS, CUSTOM_ENTERPRISE_BASE, annualize } from "@flexflow/plans";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/i18n";

/**
 * Return page for a hosted card checkout (Stripe / Paystack).
 *
 * There is deliberately NO simulated payment step on the FlexFlow side. Plans
 * only activate after real money arrives:
 *  - Stripe/Paystack: the user already paid in the provider's hosted UI; we
 *    acknowledge here and the signed webhook finalizes the subscription.
 *  - anything else (including the old "mock" provider): refused — card payments
 *    aren't configured, so we point the user at bank transfer instead.
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
                {realProvider ? t("settings.billing.confirmProviderNote") : ""}
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
    const searchParams = useSearchParams();
    const { accessToken, refreshOrganizations } = useApp();
    const { t } = useI18n();

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

    // Refresh org cache once the URL is live so a pending webhook-based plan
    // change (real providers) is reflected in the rest of the app.
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

    const billingHref = `/settings/billing${orgId ? `?orgId=${orgId}` : ""}`;
    const realProvider = provider === "stripe" || provider === "paystack";
    const ready = Boolean(accessToken);

    return (
        <div className="mx-auto max-w-xl py-10">
            {!ready ? (
                <LoadingScreen realProvider={realProvider} />
            ) : realProvider ? (
                <DoneScreen waiting billingHref={billingHref} firstMonthFree={false} />
            ) : (
                <div className="flex flex-col items-center py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-500/15 text-warning-500">
                        <CircleAlert className="h-6 w-6" />
                    </div>
                    <h1 className="mt-5 text-xl font-semibold text-(--text-primary)">
                        {t("settings.billing.paymentsNotConfiguredTitle")}
                    </h1>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-(--text-secondary)">
                        {t("settings.billing.paymentsNotConfiguredNote")}
                    </p>
                    <div className="mt-2 flex max-w-md items-center gap-2 rounded-xl border border-(--border) bg-(--bg-sunken) px-3.5 py-2.5 text-xs text-(--text-muted)">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-success-500" />
                        {planName} · ${price}{t("settings.billing.perMonthSuffix")}
                    </div>
                    <Link
                        href={billingHref}
                        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                    >
                        <Building2 className="h-4 w-4" />
                        {t("settings.billing.confirmBackToBilling")}
                    </Link>
                </div>
            )}
        </div>
    );
}