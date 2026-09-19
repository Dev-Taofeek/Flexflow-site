import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { requireTwoFactorStepUp } from "../middleware/stepup-2fa.middleware.js";
import { assessPlanChange, hasUsedFirstMonthFree } from "../lib/billing-policy.js";
import { getOrgEntitlements, planInfoForOrg } from "../lib/entitlements.js";
import { getApiUsage, getIntelligenceUsage } from "../lib/usage.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { notifyUser } from "../services/notification.service.js";
import {
    createCheckout,
    finalizeSubscription,
    cancelSubscription,
    downgradeToFree,
    previewPricing,
    handleProviderWebhook,
    getBillingPortalUrl,
    getProvider,
} from "../services/billing.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

// POST /api/billing/webhook — provider events. Registered before auth because
// payment providers (Stripe/Paystack) deliver these without a user session;
// authenticity is enforced inside billing.service via signature verification.
// The route body arrives as a raw Buffer (mounted with express.raw in app.js)
// so signature checks use the exact bytes; we re-parse to JSON for the mock
// provider.
router.post("/webhook", async (req, res) => {
    try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
        const parsed = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
        req.body = parsed;

        const eventType = await handleProviderWebhook(req, rawBody);
        if (!eventType) return res.status(400).json(errorResponse("UNHANDLED_EVENT", "Unhandled webhook event"));
        return res.status(200).json(successResponse({ received: true, eventType }));
    } catch (error) {
        console.error(error);
        return res.status(400).json(errorResponse("WEBHOOK_ERROR", error.message));
    }
});

router.use(authenticate);

// GET /api/billing/current/:orgId — subscription + live usage for the UI.
// Any org member may view their own org's billing screen (not cross-tenant).
router.get("/current/:orgId", requireOrgRole("OWNER", "ADMIN", "MEMBER", "VIEWER"), async (req, res) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const entitlements = getOrgEntitlements(org);
        const [apiUsage, intelligenceUsage, billingEvents, openAuditEvents, firstMonthFreeUsed] = await Promise.all([
            getApiUsage(org.id),
            getIntelligenceUsage(org.id),
            prisma.billingEvent.findMany({
                where: { organizationId: org.id },
                orderBy: { createdAt: "desc" },
                take: 25,
            }),
            prisma.auditEvent.count({ where: { organizationId: org.id } }),
            hasUsedFirstMonthFree(prisma, org.id),
        ]);

        return res.status(200).json(successResponse({
            organizationId: org.id,
            planInfo: planInfoForOrg(org),
            firstMonthFreeEligible: !firstMonthFreeUsed,
            entitlements: {
                planId: entitlements.planId,
                unavailableFeatures: [],
                limits: entitlements.limits,
            },
            usage: { apiUsage, intelligenceUsage },
            billingEvents: billingEvents.map((event) => ({
                id: event.id,
                provider: event.provider,
                eventType: event.eventType,
                status: event.status,
                processedAt: event.createdAt,
            })),
            auditEventCount: openAuditEvents,
            provider: getProvider(),
            pricing: {
                pro: previewPricing({ plan: "pro" }),
                customBase: previewPricing({ plan: "custom" }),
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch billing data"));
    }
});

// POST /api/billing/preview — pure price computation, never mutates.
router.post("/preview", async (req, res) => {
    try {
        const { plan, billingCycle, addOns } = req.body;
        return res.status(200).json(successResponse(previewPricing({ plan, billingCycle, addOns })));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to preview pricing"));
    }
});

// POST /api/billing/checkout — start a checkout for the chosen configuration.
// Plan changes are upgrade-only while a paid subscription is live; step-up 2FA
// is required for users who have 2FA enabled.
router.post("/checkout", requireOrgRole("OWNER", "ADMIN"), requireTwoFactorStepUp, async (req, res) => {
    try {
        const { plan = "PRO", billingCycle = "MONTHLY", addOns = [], successUrl, cancelUrl } = req.body;
        const orgId = req.body.organizationId || req.params.orgId;
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId is required"));

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const assessment = assessPlanChange(org, { planId: plan, billingCycle });
        if (!assessment.allowed) {
            return res.status(409).json({
                ...errorResponse(assessment.code, "Your current subscription cannot be changed to a lower plan while it is active."),
                data: { code: assessment.code, upgradeOnly: true },
            });
        }

        const checkout = await createCheckout({
            organization: org,
            plan,
            billingCycle,
            addOns,
            successUrl,
            cancelUrl,
            customerEmail: req.user.email,
        });

        await recordAudit({
            organizationId: org.id,
            actorId: req.user.id,
            action: "billing.checkout_started",
            resource: "billing",
            metadata: { plan, billingCycle, addOns },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse(checkout));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to start checkout"));
    }
});

// POST /api/billing/confirm — mock-provider completion (Stripe goes through the
// webhook below). Only reachable when the mock provider is active, so a real
// payment provider can never grant entitlements through this self-service path.
router.post("/confirm", requireOrgRole("OWNER", "ADMIN"), requireTwoFactorStepUp, async (req, res) => {
    try {
        if (getProvider() !== "mock") {
            return res.status(403).json(errorResponse("FORBIDDEN", "Checkout confirmation is only available with the mock provider"));
        }

        const { sessionId, plan = "PRO", billingCycle = "MONTHLY", addOns = [], organizationId, paymentConfirmed, paymentToken, cardLast4 } = req.body;
        const orgId = organizationId || req.params.orgId || req.body.orgId;
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId is required"));

        // No free upgrades: even in mock mode the plan can only activate after a
        // payment step has been completed on the checkout page. This is the page
        // the mock provider redirects to, and the user must "pay" there first.
        // Real providers (Stripe/Paystack) enforce payment by construction and
        // finalize through their signed webhook — never through this endpoint.
        if (!(paymentConfirmed === true && typeof paymentToken === "string" && paymentToken.length >= 8)) {
            return res.status(402).json(errorResponse("PAYMENT_REQUIRED", "Payment must be completed before the plan can be activated"));
        }

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const assessment = assessPlanChange(org, { planId: plan, billingCycle });
        if (!assessment.allowed) {
            return res.status(409).json({
                ...errorResponse(assessment.code, "Your current subscription cannot be changed to a lower plan while it is active."),
                data: { code: assessment.code, upgradeOnly: true },
            });
        }

        // Record the payment that was just completed so the lifecycle journal
        // reflects an actual charge, not an entitlement grant out of thin air.
        await prisma.billingEvent.create({
            data: {
                organizationId: orgId,
                provider: "mock",
                eventType: "payment.succeeded",
                status: "ACTIVE",
                raw: {
                    paymentToken,
                    cardLast4: String(cardLast4 || "").replace(/\D/g, "").slice(-4) || null,
                    plan,
                    billingCycle,
                    addOns,
                },
            },
        });

        const { organization, firstMonthFree } = await finalizeSubscription({
            organizationId: orgId,
            planId: plan.toLowerCase(),
            billingCycle,
            addOns,
        });

        await recordAudit({
            organizationId: orgId,
            actorId: req.user.id,
            action: "billing.checkout_confirmed",
            resource: "billing",
            metadata: { sessionId, plan, billingCycle, addOns, firstMonthFree },
            ipAddress: clientIpFrom(req),
        });

        await notifyUser(req.user.id, {
            title: "Plan upgraded",
            message: firstMonthFree
                ? `${organization.name} is now on the ${plan === "PRO" ? "Pro" : "Custom"} plan — your first month is free.`
                : `${organization.name} is now on the ${plan === "PRO" ? "Pro" : "Custom"} plan.`,
            type: "SYSTEM",
        });

        return res.status(200).json(successResponse({
            organization: { ...organization, planInfo: planInfoForOrg(organization) },
            entitlements: getOrgEntitlements(organization),
            firstMonthFree,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to confirm checkout"));
    }
});

// GET /api/billing/portal/:orgId — manage billing in the provider portal.
router.get("/portal/:orgId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const url = await getBillingPortalUrl(req.params.orgId);
        return res.status(200).json(successResponse({ url, provider: getProvider() }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to open billing portal"));
    }
});

// POST /api/billing/cancel/:orgId — cancel at the end of the current window.
router.post("/cancel/:orgId", requireOrgRole("OWNER"), async (req, res) => {
    try {
        const org = await cancelSubscription(req.params.orgId);
        await recordAudit({
            organizationId: req.params.orgId,
            actorId: req.user.id,
            action: "billing.subscription_cancelled",
            resource: "billing",
            ipAddress: clientIpFrom(req),
        });
        await notifyUser(req.user.id, {
            title: "Subscription cancelled",
            message: `${org.name} keeps paid access until ${org.subscriptionEndAt?.toISOString().slice(0, 10)}.`,
            type: "SYSTEM",
            url: `/settings/billing?orgId=${req.params.orgId}`,
            dedupeKey: `billing.cancel.${req.params.orgId}`,
        });
        return res.status(200).json(successResponse({ organization: org }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to cancel subscription"));
    }
});

// POST /api/billing/downgrade/:orgId — dev/testing helper: drop back to FREE.
// Disabled in production so nobody can self-serve a plan downgrade to dodge bills.
router.post("/downgrade/:orgId", requireOrgRole("OWNER"), async (req, res) => {
    try {
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json(errorResponse("FORBIDDEN", "Manual downgrade is disabled in production"));
        }

        const org = await downgradeToFree(req.params.orgId);
        await notifyUser(req.user.id, {
            title: "Plan downgraded",
            message: `${org.name} is back on the Free plan.`,
            type: "SYSTEM",
        });
        return res.status(200).json(successResponse({ organization: org }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to downgrade plan"));
    }
});

export { router as billingRouter };