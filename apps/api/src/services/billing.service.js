import { computeCustomConfig, PLANS, getPlanLimits } from "@flexflow/plans";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { createHmac } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Billing service — provider abstraction.
//
// The app ships with a built-in "mock" provider so the full subscription flow
// (checkout → confirm → active plan → usage limits) works end to end with zero
// external dependencies. Point BILLING_PROVIDER at "stripe" or "paystack" (and
// set the matching env vars) to swap in a real payment provider without
// touching any route code.
//
// Hard rules:
//  - Prices are always recomputed server-side; client-provided amounts are
//    never trusted.
//  - An organization only ever gains paid entitlements through this service.
//  - Webhook payloads are verified by signature (Stripe HMAC-header check,
//    Paystack HMAC-SHA512 over the exact raw body).
// ─────────────────────────────────────────────────────────────────────────────

export function getProvider() {
    return (process.env.BILLING_PROVIDER || "mock").toLowerCase();
}

export function isProvider(provider) {
    return getProvider() === provider.toLowerCase();
}

function toPlanId(plan) {
    const normalized = String(plan || "").toUpperCase();
    if (normalized === "PRO") return "pro";
    if (normalized === "CUSTOM") return "custom";
    return "free";
}

/** Minimal Paystack REST client. All amounts are handled in kobo internally. */
async function paystackRequest(path, body, { method = "POST" } = {}) {
    const secret = env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");

    const res = await fetch(`https://api.paystack.co/${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    let json;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Paystack API returned ${res.status}`);
    }

    if (!res.ok || json.status === false) {
        throw new Error(json.message || `Paystack API error (${res.status})`);
    }
    return json.data;
}

/** Stripe price id lookup for a plan/cycle. Fetches from env when available. */
function priceIdFor({ planId, billingCycle, addOns = [] }) {
    if (planId === "free") return null;
    const cycle = billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";
    const base = process.env[`STRIPE_PRICE_${planId.toUpperCase()}_${cycle}`];
    if (planId === "custom") {
        const addonPriceIds = addOns
            .map((addon) => process.env[`STRIPE_PRICE_ADDON_${String(addon).toUpperCase()}_${cycle}`])
            .filter(Boolean);
        return { base, addons: addonPriceIds };
    }
    return base || null;
}

/** Price preview for a target configuration (never mutates anything). */
export function previewPricing({ plan = "free", billingCycle = "MONTHLY", addOns = [] }) {
    const planId = toPlanId(plan);
    const target = planId === "custom"
        ? computeCustomConfig({ addOns, billingCycle })
        : null;

    const planDef = PLANS[planId];
    const monthly = target ? target.monthly : planDef.priceMonthly;
    const annual = target ? target.annual : planDef.priceAnnual;

    return {
        planId,
        planName: planDef.name,
        billingCycle,
        pricePerMonth: billingCycle === "ANNUAL" ? Math.round((annual / 12) * 100) / 100 : monthly,
        priceMonthly: monthly,
        priceAnnual: annual,
        basePlan: planId === "custom" ? "pro" : planId,
        addOnCount: planId === "custom" ? addOns.length : 0,
        addOns: planId === "custom" ? addOns : [],
        provider: getProvider(),
    };
}

/**
 * Starts a checkout for upgrading `organization` to a target plan.
 * Returns a `{ url, provider, mode }` checkout handle.
 * - mock: returns the app-internal confirm URL carrying a signed-ish session id.
 * - stripe: creates a real Checkout Session (requires STRIPE_SECRET_KEY).
 * - paystack: creates an authorize URL (requires PAYSTACK_SECRET_KEY).
 */
export async function createCheckout({
    organization,
    plan = "PRO",
    billingCycle = "MONTHLY",
    addOns = [],
    successUrl,
    cancelUrl,
    customerEmail,
}) {
    const planId = toPlanId(plan);
    const provider = getProvider();

    if (provider === "stripe") {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
        const price = priceIdFor({ planId, billingCycle, addOns });
        if (!price) throw new Error("Missing Stripe price id for this plan configuration");

        const mode = "subscription";
        const lineItems = Array.isArray(price)
            ? [...(price.base ? [{ price: price.base, quantity: 1 }] : []), ...price.addons.map((p) => ({ price: p, quantity: 1 }))]
            : [{ price, quantity: 1 }];

        const session = await stripe.checkout.sessions.create({
            mode,
            customer_email: customerEmail,
            success_url: `${successUrl || env.CLIENT_ORIGIN}/billing/confirm?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
            cancel_url: cancelUrl || `${env.CLIENT_ORIGIN}/pricing`,
            line_items: lineItems,
            client_reference_id: organization.id,
            metadata: { organizationId: organization.id, planId, billingCycle, addOns: JSON.stringify(addOns) },
        });

        return { url: session.url, provider, mode };
    }

    if (provider === "paystack") {
        // Amount is charged in the account's base currency (NGN for most
        // Paystack accounts) as kobo. The plan prices are USD figures; a
        // per-BASE-to-local rate is applied when configured.
        const pricing = previewPricing({ plan: planId, billingCycle, addOns });
        const amountInMinor = Math.round(
            pricing.priceMonthly * (Number(process.env.PAYSTACK_TO_LOCAL_RATE) || 1) * 100,
        );

        const metadata = {
            organizationId: organization.id,
            planId,
            billingCycle,
            addOns: JSON.stringify(addOns),
        };

        const data = await paystackRequest("transaction/initialize", {
            email: customerEmail,
            amount: amountInMinor,
            reference: `ff_${organization.id.slice(0, 8)}_${Date.now()}`,
            callback_url: `${successUrl || env.CLIENT_ORIGIN}/billing/confirm?provider=paystack&org=${organization.id}`,
            cancel_url: cancelUrl || `${env.CLIENT_ORIGIN}/pricing`,
            metadata,
        });

        return { url: data.authorization_url, reference: data.reference, provider, mode: "payment" };
    }

    // ── Mock provider ──────────────────────────────────────────────────────
    const mockSessionId = `mock_${Buffer.from(JSON.stringify({
        organizationId: organization.id,
        planId,
        billingCycle,
        addOns,
    })).toString("base64url")}`;

    const query = new URLSearchParams({
        provider: "mock",
        session_id: mockSessionId,
        plan: planId,
        billingCycle,
        addOns: JSON.stringify(addOns),
        orgId: organization.id,
    }).toString();

    return {
        url: `${successUrl || env.CLIENT_ORIGIN}/billing/confirm?${query}`,
        provider,
        mode: "subscription",
    };
}

/**
 * Completes a checkout. For the mock provider this promotes the org directly.
 * For Stripe this is the authoritative webhook path (`subscribed`/`invoice.paid`).
 * Returns `{ organization, entitlements }`.
 */
export async function finalizeSubscription({ organizationId, planId, billingCycle = "MONTHLY", addOns = [] }) {
    const planDef = PLANS[planId];
    const now = new Date();

    const endAt =
        billingCycle === "ANNUAL"
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const org = await prisma.organization.update({
        where: { id: organizationId },
        data: {
            plan: planId === "pro" ? "PRO" : "CUSTOM",
            billingCycle,
            subscriptionStatus: "ACTIVE",
            subscriptionStartAt: now,
            subscriptionEndAt: endAt,
            customAddOns: planId === "custom" ? addOns : [],
        },
    });

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: getProvider(),
            eventType: "checkout.completed",
            status: "ACTIVE",
            raw: { planId, billingCycle, addOns, amountMonthly: planDef.priceMonthly },
        },
    });

    return { organization: org };
}

/** Cancel a subscription — paid access continues until the end of the window. */
export async function cancelSubscription(organizationId) {
    if (isProvider("paystack")) {
        // Best-effort remote cancel: disable any Paystack subscription tied to
        // this org's email/transaction reference.
        try {
            const subscriptions = await paystackRequest(`subscription?perPage=50`);
            const org = await prisma.organization.findUnique({ where: { id: organizationId } });
            const orgSubscriptions = subscriptions.filter(
                (sub) =>
                    sub.customer?.email?.toLowerCase() === org?.billingEmail?.toLowerCase() ||
                    sub.customer?.email?.toLowerCase() === "",
            );
            await Promise.all(
                orgSubscriptions.map((sub) =>
                    paystackRequest("subscription/disable", { code: sub.subscription_code, token: sub.email_token }),
                ),
            );
        } catch (error) {
            console.warn("Paystack remote cancel skipped:", error.message);
        }
    }

    const org = await prisma.organization.update({
        where: { id: organizationId },
        data: { subscriptionStatus: "CANCELLED" },
    });

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: getProvider(),
            eventType: "subscription.cancelled",
            status: "CANCELLED",
            raw: { cancelledAt: new Date().toISOString() },
        },
    });

    return org;
}

/** Downgrade back to FREE immediately (used by admin/dev flows, never by users). */
export async function downgradeToFree(organizationId) {
    return prisma.organization.update({
        where: { id: organizationId },
        data: {
            plan: "FREE",
            billingCycle: "MONTHLY",
            subscriptionStatus: "ACTIVE",
            subscriptionStartAt: null,
            subscriptionEndAt: null,
            customAddOns: [],
        },
    });
}

/** Billing portal URL. Mock returns the billing settings page in the app. */
export async function getBillingPortalUrl(organizationId) {
    if (isProvider("stripe")) {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
        const session = await stripe.billingPortal.sessions.create({ customer: organizationId });
        return session.url;
    }
    return `${env.CLIENT_ORIGIN}/settings/billing?orgId=${organizationId}&from=portal`;
}

/**
 * Handles an incoming billing webhook payload. Delivery is verified by
 * signature for both real providers:
 *  - Stripe: HMAC-SHA256 via the `stripe-signature` header / webhook secret.
 *  - Paystack: HMAC-SHA512 of the exact raw body via `x-paystack-signature`,
 *    then only state-changing events are processed.
 * Returns the event type processed (or null when unhandled).
 */
export async function handleProviderWebhook(req, rawBody) {
    const provider = getProvider();

    if (provider === "stripe") {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
        const signature = req.headers["stripe-signature"];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!signature || !webhookSecret) return null;

        const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        const metadata = event.data?.object?.metadata || {};
        const organizationId = metadata.organizationId || event.data?.object?.client_reference_id;

        if (!organizationId) return null;

        const planId = metadata.planId || "pro";
        const billingCycle = metadata.billingCycle || "MONTHLY";
        const addOns = JSON.parse(metadata.addOns || "[]");

        await prisma.billingEvent.create({
            data: {
                organizationId,
                provider: "stripe",
                providerEventId: event.id,
                eventType: event.type,
                status: event.data?.object?.status,
                raw: event.data?.object,
            },
        });

        if (event.type === "checkout.session.completed") {
            await finalizeSubscription({ organizationId, planId, billingCycle, addOns });
        }

        return event.type;
    }

    if (provider === "paystack") {
        const signature = req.headers["x-paystack-signature"];
        const secret = env.PAYSTACK_WEBHOOK_SECRET;
        if (!signature || !secret || !rawBody) {
            throw new Error("Missing Paystack webhook signature or secret");
        }

        const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
        const actual = Array.isArray(signature) ? signature.join("") : signature;
        if (expected !== actual) {
            throw new Error("Invalid Paystack webhook signature");
        }

        let event;
        try {
            event = JSON.parse(rawBody);
        } catch {
            throw new Error("Invalid Paystack webhook payload");
        }

        const metadata = event.data?.metadata || {};
        const organizationId = metadata.organizationId;

        // Events we accept as authoritative proof of payment.
        const paymentEvents = new Set(["charge.success", "subscription.create"]);

        await prisma.billingEvent.create({
            data: {
                organizationId: organizationId || null,
                provider: "paystack",
                providerEventId: event.data?.reference || event.id || null,
                eventType: event.event,
                status: event.data?.status || null,
                raw: event.data || null,
            },
        });

        if (organizationId && paymentEvents.has(event.event)) {
            const planId = metadata.planId || "pro";
            const billingCycle = metadata.billingCycle || "MONTHLY";
            const addOns = JSON.parse(metadata.addOns || "[]");
            await finalizeSubscription({ organizationId, planId, billingCycle, addOns });
        }

        return event.event;
    }

    // ── Mock provider webhook — same shape the client confirm route uses. ──
    const organizationId = req.body?.organizationId;
    if (!organizationId) return null;

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: "mock",
            eventType: req.body?.eventType || "webhook",
            status: req.body?.status || null,
            raw: req.body || null,
        },
    });

    return req.body?.eventType || "webhook";
}