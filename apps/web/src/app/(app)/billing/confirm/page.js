"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { useI18n } from "@/i18n";

/**
 * Checkout return page. The mock provider lands here with the checkout
 * parameters and we finalize server-side; real providers (Stripe/Paystack)
 * return here after their hosted UI and finalize via signed webhook, so we
 * simply acknowledge and refresh entitlements.
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

function BillingConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { accessToken, refreshOrganizations } = useApp();
    const { t } = useI18n();
    const { runWithStepUp } = useStepUp();

    const [state, setState] = useState("working");
    const [message, setMessage] = useState("");
    const [firstMonthFree, setFirstMonthFree] = useState(false);
    const startedRef = useRef(false);

    const orgId = searchParams.get("orgId") || searchParams.get("org");
    const provider = searchParams.get("provider") || "mock";

    const run = useCallback(async () => {
        if (startedRef.current || !accessToken) return;
        startedRef.current = true;
        try {
            // Real providers confirm payment through their signed webhook.
            if (provider !== "mock") {
                await refreshOrganizations();
                setState("done");
                return;
            }

            if (!orgId) throw new Error(t("settings.billing.confirmError"));

            const plan = searchParams.get("plan");
            const billingCycle = searchParams.get("billingCycle");
            const sessionIdParam = searchParams.get("session_id");
            if (!plan || !billingCycle || !sessionIdParam) {
                throw new Error(t("settings.billing.confirmErrorInvalidParams"));
            }

            let addOns = [];
            try {
                addOns = JSON.parse(searchParams.get("addOns") || "[]");
            } catch {
                addOns = [];
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
                        plan,
                        billingCycle,
                        addOns,
                    },
                }),
            );

            if (result?.firstMonthFree) setFirstMonthFree(true);
            await refreshOrganizations();
            setState("done");
            const target = `/settings/billing${orgId ? `?orgId=${orgId}` : ""}`;
            setTimeout(() => router.replace(target), 1500);
        } catch (err) {
            setState("error");
            setMessage(err.message || t("settings.billing.confirmError"));
        }
    }, [accessToken, orgId, provider, searchParams, refreshOrganizations, router, t, runWithStepUp]);

    useEffect(() => {
        const timer = setTimeout(() => { run(); }, 0);
        return () => clearTimeout(timer);
    }, [run]);

    const billingHref = `/settings/billing${orgId ? `?orgId=${orgId}` : ""}`;

    return (
        <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
            <div
                className={[
                    "flex h-14 w-14 items-center justify-center rounded-2xl",
                    state === "error" ? "bg-danger-500/15 text-danger-500" : "bg-brand-500/15 text-brand-500",
                ].join(" ")}
            >
                {state === "working" && <Loader2 className="h-6 w-6 animate-spin" />}
                {state === "done" && <CheckCircle2 className="h-6 w-6 text-success-500" />}
                {state === "error" && <CircleAlert className="h-6 w-6" />}
            </div>

            <h1 className="mt-5 text-xl font-semibold text-(--text-primary)">
                {t("settings.billing.confirmTitle")}
            </h1>
            <p className="mt-2 text-sm text-(--text-secondary)">
                {state === "working" && (provider === "mock" ? t("settings.billing.confirmSubtitle") : t("settings.billing.confirmProviderNote"))}
                {state === "done" && t("settings.billing.confirmSuccess")}
                {state === "error" && message}
            </p>
            {state === "done" && firstMonthFree ? (
                <p className="mt-2 rounded-full bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-600">
                    {t("settings.billing.firstMonthFreeApplied")}
                </p>
            ) : null}

            {(state === "done" || state === "error") && (
                <Link
                    href={billingHref}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                >
                    {t("settings.billing.confirmBack")}
                </Link>
            )}
        </div>
    );
}
