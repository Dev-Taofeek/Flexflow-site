import { computeCustomConfig, PLANS, getPlanLimits } from "@flexflow/plans";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { secureEqual } from "../lib/secure-compare.js";
import { createHmac } from "node:crypto";
import {
    expiryWarningDedupeKey,
    requiredLifecycleTransition,
    hasUsedFirstMonthFree,
} from "../lib/billing-policy.js";
import { notifyUser } from "./notification.service.js";

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
 * Bank-transfer settlement details, environment-tunable. Defaults target the
 * FlexFlow OPay/PalmPay account; real deployments should pin the env vars.
 * Account/amounts are display-only — entitlements are granted only after an
 * OWNER approves the uploaded receipt.
 */
export function getBankTransferConfig() {
    const accountNumber = String(process.env.BANK_TRANSFER_ACCOUNT_NUMBER || "7048578739").replace(/\D/g, "").slice(0, 20);
    const accountName = String(process.env.BANK_TRANSFER_ACCOUNT_NAME || "FlexFlow").slice(0, 120);
    const banks = String(process.env.BANK_TRANSFER_BANKS || "OPay,PalmPay")
        .split(",")
        .map((bank) => bank.trim())
        .filter(Boolean);
    return { accountNumber, accountName, banks, currency: "NGN" };
}

/** Due amount (local + minor units) for a target plan/cycle/add-ons. */
export function transferAmountMinor({ plan = "PRO", billingCycle = "MONTHLY", addOns = [] }) {
    const pricing = previewPricing({ plan, billingCycle, addOns });
    const periodAmount = billingCycle === "ANNUAL" ? pricing.priceAnnual : pricing.priceMonthly;
    const rate = Number(process.env.PAYSTACK_TO_LOCAL_RATE) || 1;
    return {
        pricing,
        amountLocal: Math.round(periodAmount * rate),
        amountMinor: Math.round(periodAmount * rate * 100),
    };
}

/**
 * Opens a bank-transfer intent for an upgrade. Reuses an open PENDING or
 * UNDER_REVIEW intent for the same plan config so re-submits never stack.
 * No entitlement is granted here — that only happens after OWNER review.
 */
export async function createTransferIntent({ organizationId, userId, plan = "PRO", billingCycle = "MONTHLY", addOns = [] }) {
    const planId = toPlanId(plan);
    if (planId !== "pro" && planId !== "custom") {
        const err = new Error("Bank transfer is only available for Pro and Custom plans");
        err.statusCode = 422;
        throw err;
    }
    const normalizedCycle = billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";

    const existing = await prisma.payment.findFirst({
        where: {
            organizationId,
            method: "BANK_TRANSFER",
            plan: planId === "custom" ? "CUSTOM" : "PRO",
            billingCycle: normalizedCycle,
            status: { in: ["PENDING", "UNDER_REVIEW"] },
        },
        orderBy: { createdAt: "desc" },
    });
    if (existing) {
        return { payment: existing, bankTransfer: getBankTransferConfig(), reused: true };
    }

    const { amountMinor } = transferAmountMinor({ plan, billingCycle: normalizedCycle, addOns });
    const bank = getBankTransferConfig();
    const reference = `FF-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await prisma.payment.create({
        data: {
            organizationId,
            userId,
            plan: planId === "custom" ? "CUSTOM" : "PRO",
            billingCycle: normalizedCycle,
            addOns: addOns || [],
            amountMinor,
            method: "BANK_TRANSFER",
            provider: "manual",
            status: "PENDING",
            bankName: bank.banks[0] || "OPay",
            accountNumber: bank.accountNumber,
            accountName: bank.accountName,
            reference,
        },
    });

    return { payment, bankTransfer: bank, reused: false };
}

const ALLOWED_RECEIPT_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

/**
 * Attaches a receipt to an open bank-transfer intent and moves it UNDER_REVIEW,
 * then alerts the organization's OWNER/ADMIN roles. The receipt is a validated
 * data URL; size is capped so storage stays sane.
 */
export async function submitTransferReceipt({ paymentId, organizationId, receiptData, receiptMime, note }) {
    const payment = await prisma.payment.findFirst({
        where: { id: paymentId, organizationId, method: "BANK_TRANSFER" },
        include: { organization: { select: { name: true } } },
    });
    if (!payment) {
        const err = new Error("Payment not found");
        err.statusCode = 404;
        throw err;
    }
    if (!["PENDING", "UNDER_REVIEW"].includes(payment.status)) {
        const err = new Error("This payment can no longer be updated");
        err.statusCode = 409;
        throw err;
    }

    const mime = String(receiptMime || "").toLowerCase();
    if (!ALLOWED_RECEIPT_MIMES.has(mime)) {
        const err = new Error("Receipt must be a PNG, JPG, WebP, or PDF file");
        err.statusCode = 422;
        throw err;
    }
    if (typeof receiptData !== "string" || !/^data:[a-z0-9./-]+;base64,[a-zA-Z0-9+/=]+$/.test(receiptData)) {
        const err = new Error("Invalid receipt upload");
        err.statusCode = 422;
        throw err;
    }
    const decoded = Buffer.from(receiptData.split(",")[1], "base64");
    if (!decoded.length || decoded.length > MAX_RECEIPT_BYTES) {
        const err = new Error("Receipt file is too large");
        err.statusCode = 422;
        throw err;
    }

    const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
            status: "UNDER_REVIEW",
            receiptImage: receiptData,
            receiptMime: mime,
            noteByUser: typeof note === "string" ? note.slice(0, 1000) : null,
        },
    });

    const admins = await prisma.organizationMember.findMany({
        where: { organizationId, role: { in: ["OWNER", "ADMIN"] } },
        select: { userId: true },
    });
    await Promise.all(
        admins.map((member) =>
            notifyUser(member.userId, {
                title: "Bank transfer payment submitted",
                message: `${payment.organization.name} uploaded a transfer receipt (${payment.reference}) and it's awaiting your review.`,
                type: "BILLING",
                url: `/settings/billing?orgId=${organizationId}`,
                dedupeKey: `billing.transfer.${payment.id}`,
            }),
        ),
    );

    return { payment: updated };
}

/**
 * OWNER review of a bank-transfer payment. Approving finalizes the
 * subscription (the only path that grants paid entitlements for transfers);
 * rejecting leaves the org on its current plan. Only PENDING/UNDER_REVIEW
 * intents can be reviewed once.
 */
export async function reviewTransferPayment({ paymentId, organizationId, reviewerId, decision, note }) {
    const payment = await prisma.payment.findFirst({
        where: { id: paymentId, organizationId, method: "BANK_TRANSFER" },
    });
    if (!payment) {
        const err = new Error("Payment not found");
        err.statusCode = 404;
        throw err;
    }
    if (!["PENDING", "UNDER_REVIEW"].includes(payment.status)) {
        const err = new Error("This payment has already been reviewed");
        err.statusCode = 409;
        throw err;
    }

    const approved = String(decision).toLowerCase() === "approve";
    if (!approved && String(decision).toLowerCase() !== "reject") {
        const err = new Error("decision must be approve or reject");
        err.statusCode = 422;
        throw err;
    }

    const now = new Date();
    if (approved) {
        const { organization, firstMonthFree } = await finalizeSubscription({
            organizationId,
            planId: payment.plan.toLowerCase(),
            billingCycle: payment.billingCycle,
            addOns: payment.addOns,
            providerRefs: { providerSubscriptionId: payment.reference || null },
        });

        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: now, approvedAt: now },
        });

        await prisma.billingEvent.create({
            data: {
                organizationId,
                provider: "manual",
                eventType: "payment.succeeded",
                status: "ACTIVE",
                raw: {
                    paymentId: payment.id,
                    reference: payment.reference,
                    amountMinor: payment.amountMinor,
                    currency: payment.currency,
                    bankName: payment.bankName,
                    accountNumber: payment.accountNumber,
                    method: "BANK_TRANSFER",
                    reviewedById: reviewerId,
                },
            },
        });

        return { payment: { ...payment, status: "APPROVED" }, organization, firstMonthFree, approved: true };
    }

    await prisma.payment.update({
        where: { id: payment.id },
        data: {
            status: "REJECTED",
            reviewedById: reviewerId,
            reviewedAt: now,
            noteByUser: typeof note === "string" ? note.slice(0, 1000) : payment.noteByUser,
        },
    });

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: "manual",
            eventType: "payment.failed",
            status: "PAYMENT_FAILED",
            raw: {
                paymentId: payment.id,
                reference: payment.reference,
                method: "BANK_TRANSFER",
                rejectedBy: reviewerId,
                note: typeof note === "string" ? note.slice(0, 1000) : null,
            },
        },
    });

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });

    return { payment: { ...payment, status: "REJECTED" }, approved: false, organization: org || { name: "Your organization" } };
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
        // per-BASE-to-local rate is applied when configured. The full periodic
        // amount is due up front: an ANNUAL checkout charges the whole year,
        // MONTHLY charges the standard price.
        const pricing = previewPricing({ plan: planId, billingCycle, addOns });
        const periodAmount = billingCycle === "ANNUAL" ? pricing.priceAnnual : pricing.priceMonthly;
        const amountInMinor = Math.round(
            periodAmount * (Number(process.env.PAYSTACK_TO_LOCAL_RATE) || 1) * 100,
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
export async function finalizeSubscription({ organizationId, planId, billingCycle = "MONTHLY", addOns = [], providerRefs = {} }) {
    const normalizedPlanId = toPlanId(planId);
    if (!PLANS[normalizedPlanId] || normalizedPlanId === "free") {
        throw new Error("Unknown plan for subscription");
    }

    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Renewals extend from the current paid-through date instead of resetting
    // the clock, so a duplicate/mid-cycle webhook never shortens coverage.
    const current = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            subscriptionEndAt: true,
            subscriptionStatus: true,
            subscriptionStartAt: true,
        },
    });
    const base =
        current?.subscriptionStatus === "ACTIVE" &&
        current?.subscriptionEndAt &&
        new Date(current.subscriptionEndAt) > now
            ? new Date(current.subscriptionEndAt)
            : now;

    // One-time "first month free": only for orgs that have never completed a
    // paid checkout. The bonus is stacked on top of the paid term (+30 days).
    const usedFreeMonth = current?.subscriptionStartAt
        ? true
        : await hasUsedFirstMonthFree(prisma, organizationId);
    const firstMonthFree = !usedFreeMonth;

    const periodMs = billingCycle === "ANNUAL" ? 365 * DAY_MS : 30 * DAY_MS;
    let endAt = new Date(base.getTime() + periodMs);
    if (firstMonthFree) endAt = new Date(endAt.getTime() + 30 * DAY_MS);

    const org = await prisma.organization.update({
        where: { id: organizationId },
        data: {
            plan: normalizedPlanId === "pro" ? "PRO" : "CUSTOM",
            billingCycle,
            subscriptionStatus: "ACTIVE",
            subscriptionStartAt: current?.subscriptionStartAt || now,
            subscriptionEndAt: endAt,
            customAddOns: normalizedPlanId === "custom" ? addOns : [],
            ...(providerRefs.providerCustomerId ? { providerCustomerId: providerRefs.providerCustomerId } : {}),
            ...(providerRefs.providerSubscriptionId ? { providerSubscriptionId: providerRefs.providerSubscriptionId } : {}),
        },
    });

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: getProvider(),
            eventType: "checkout.completed",
            status: "ACTIVE",
            raw: {
                planId: normalizedPlanId,
                billingCycle,
                addOns,
                amountMonthly: PLANS[normalizedPlanId].priceMonthly,
                firstMonthFree,
            },
        },
    });

    return { organization: org, firstMonthFree };
}

/** Cancel a subscription — paid access continues until the end of the window. */
export async function cancelSubscription(organizationId) {
    if (isProvider("paystack")) {
        // Best-effort remote cancel: disable any Paystack subscription tied to
        // this org via the stored provider references (subscription/customer
        // code captured at checkout — the org has no direct billing email).
        try {
            const subscriptions = await paystackRequest(`subscription?perPage=50`);
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { providerSubscriptionId: true, providerCustomerId: true },
            });
            const orgSubscriptions = subscriptions.filter(
                (sub) =>
                    (org?.providerSubscriptionId && sub.subscription_code === org.providerSubscriptionId) ||
                    (org?.providerCustomerId && sub.customer?.customer_code === org.providerCustomerId),
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
    const org = await prisma.organization.update({
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

    await prisma.billingEvent.create({
        data: {
            organizationId,
            provider: getProvider(),
            eventType: "subscription.expired",
            status: "EXPIRED",
            raw: { movedToFreeAt: new Date().toISOString() },
        },
    });

    return org;
}

/** Billing portal URL. Mock returns the billing settings page in the app. */
export async function getBillingPortalUrl(organizationId) {
    if (isProvider("stripe")) {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { providerCustomerId: true },
        });
        if (!org?.providerCustomerId) {
            throw new Error("No Stripe customer is linked to this organization yet");
        }
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
        const session = await stripe.billingPortal.sessions.create({ customer: org.providerCustomerId });
        return session.url;
    }
    return `${env.CLIENT_ORIGIN}/settings/billing?orgId=${organizationId}&from=portal`;
}

/** Idempotency guard — returns true when this provider event already exists. */
async function eventAlreadyProcessed(provider, providerEventId) {
    if (!providerEventId) return false;
    const existing = await prisma.billingEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId } },
        select: { id: true },
    });
    return Boolean(existing);
}

/** BillingEvent.status maps to the Prisma `SubscriptionStatus` enum. Provider
 * payloads use their own vocabulary (Stripe: "complete"/"paid"/"active",
 * Paystack: "success"), so anything that isn't a valid enum value must be
 * dropped — otherwise the webhook insert throws P2009 and paid plans never
 * activate. */
const VALID_SUBSCRIPTION_STATUSES = new Set([
    "ACTIVE",
    "TRIALING",
    "PAST_DUE",
    "CANCELLED",
    "EXPIRED",
    "PAYMENT_FAILED",
    "INCOMPLETE",
]);

function normalizeSubscriptionStatus(status) {
    if (!status) return null;
    const normalized = String(status).toUpperCase();
    return VALID_SUBSCRIPTION_STATUSES.has(normalized) ? normalized : null;
}

/** Persists a billing event, tolerating a concurrent duplicate insert. */
async function persistBillingEvent({ organizationId, provider, providerEventId, eventType, status, raw }) {
    if (await eventAlreadyProcessed(provider, providerEventId)) return null;
    try {
        return await prisma.billingEvent.create({
            data: {
                organizationId: organizationId || null,
                provider,
                providerEventId: providerEventId || null,
                eventType,
                status: normalizeSubscriptionStatus(status),
                raw: raw || null,
            },
        });
    } catch (error) {
        if (error?.code === "P2002") return null; // concurrent duplicate — safe
        throw error;
    }
}

/**
 * Handles an incoming billing webhook payload. Delivery is verified by
 * signature for both real providers:
 *  - Stripe: HMAC-SHA256 via the `stripe-signature` header / webhook secret.
 *  - Paystack: HMAC-SHA512 of the exact raw body via `x-paystack-signature`,
 *    then only state-changing events are processed.
 * Every event is persisted exactly once (idempotency via provider event id).
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

        await persistBillingEvent({
            organizationId,
            provider: "stripe",
            providerEventId: event.id,
            eventType: event.type,
            status: event.data?.object?.status,
            raw: event.data?.object,
        });

        if (event.type === "checkout.session.completed" && !(await eventAlreadyProcessed("stripe", event.id))) {
            const planId = metadata.planId || "pro";
            const billingCycle = metadata.billingCycle || "MONTHLY";
            const addOns = JSON.parse(metadata.addOns || "[]");
            await finalizeSubscription({
                organizationId,
                planId,
                billingCycle,
                addOns,
                providerRefs: {
                    providerSubscriptionId: event.data?.object?.subscription || null,
                    providerCustomerId: event.data?.object?.customer || null,
                },
            });
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
        if (!secureEqual(expected, actual)) {
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
        const providerEventId = event.data?.reference || event.id || null;

        await persistBillingEvent({
            organizationId,
            provider: "paystack",
            providerEventId,
            eventType: event.event,
            status: event.data?.status || null,
            raw: event.data || null,
        });

        // Events we accept as authoritative proof of payment.
        const paymentEvents = new Set(["charge.success", "subscription.create"]);

        if (organizationId && paymentEvents.has(event.event) && !(await eventAlreadyProcessed("paystack", providerEventId))) {
            const planId = metadata.planId || "pro";
            const billingCycle = metadata.billingCycle || "MONTHLY";
            const addOns = JSON.parse(metadata.addOns || "[]");
            await finalizeSubscription({
                organizationId,
                planId,
                billingCycle,
                addOns,
                providerRefs: {
                    providerSubscriptionId: event.data?.subscription_code || event.data?.id || null,
                    providerCustomerId: event.data?.customer?.id || null,
                },
            });
        }

        return event.event;
    }

    // ── Mock provider webhook — same shape the client confirm route uses. ──
    const organizationId = req.body?.organizationId;
    if (!organizationId) return null;

    await persistBillingEvent({
        organizationId,
        provider: "mock",
        providerEventId: req.body?.id || null,
        eventType: req.body?.eventType || "webhook",
        status: req.body?.status || null,
        raw: req.body || null,
    });

    return req.body?.eventType || "webhook";
}

/**
 * Periodic subscription sweep. Walks every paid org and applies the lifecycle
 * policy decided by billing-policy.js:
 *  - warns OWNER/ADMIN 7 days before the paid window ends (idempotent, deduped),
 *  - marks the subscription PAST_DUE while inside the grace period,
 *  - silently downgrades to FREE once the grace period has elapsed.
 * Safe to run on every boot and on a repeating interval — transitions are
 * irreversible-by-construction and the notifications are de-duplicated.
 */
export async function processExpiringSubscriptions(now = new Date()) {
    const orgs = await prisma.organization.findMany({
        where: {
            plan: { in: ["PRO", "CUSTOM"] },
            subscriptionEndAt: { not: null },
        },
        select: {
            id: true,
            name: true,
            plan: true,
            billingCycle: true,
            subscriptionStatus: true,
            subscriptionEndAt: true,
            members: {
                where: { role: { in: ["ADMIN", "OWNER"] } },
                select: { id: true, userId: true },
            },
        },
    });

    const summary = { warned: 0, pastDue: 0, downgraded: 0 };

    for (const org of orgs) {
        const transition = requiredLifecycleTransition(org, now);
        if (!transition) continue;

        const adminIds = org.members.map((m) => m.userId);

        if (transition === "warn") {
            const dedupeKey = expiryWarningDedupeKey(org);
            await Promise.all(
                adminIds.map((userId) =>
                    notifyUser(userId, {
                        title: "Subscription expiring soon",
                        message: `Your ${org.plan.toLowerCase()} subscription for ${org.name} ends on ${new Date(org.subscriptionEndAt).toISOString().slice(0, 10)}. Renew to keep paid features.`,
                        type: "BILLING",
                        dedupeKey,
                    }),
                ),
            );
            summary.warned += 1;
            continue;
        }

        if (transition === "grace") {
            await prisma.organization.update({
                where: { id: org.id },
                data: { subscriptionStatus: "PAST_DUE" },
            });
            await persistBillingEvent({
                organizationId: org.id,
                provider: getProvider(),
                eventType: "subscription.past_due",
                status: "PAST_DUE",
                raw: { enteredGraceAt: new Date().toISOString() },
            });
            await Promise.all(
                adminIds.map((userId) =>
                    notifyUser(userId, {
                        title: "Subscription past due",
                        message: `Your subscription for ${org.name} is in its grace period. Renew within the grace window to continue using paid features.`,
                        type: "BILLING",
                    }),
                ),
            );
            summary.pastDue += 1;
            continue;
        }

        if (transition === "downgrade" && org.subscriptionStatus !== "EXPIRED") {
            await downgradeToFree(org.id);
            await Promise.all(
                adminIds.map((userId) =>
                    notifyUser(userId, {
                        title: "Subscription expired",
                        message: `${org.name} has been moved to the Free plan because the paid subscription expired.`,
                        type: "BILLING",
                    }),
                ),
            );
            summary.downgraded += 1;
        }
    }

    return summary;
}