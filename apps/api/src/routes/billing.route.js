import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { enforceFeature, getOrgEntitlements, planInfoForOrg } from "../lib/entitlements.js";
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
router.get("/current/:orgId", async (req, res) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const entitlements = getOrgEntitlements(org);
        const [apiUsage, intelligenceUsage, billingEvents, openAuditEvents] = await Promise.all([
            getApiUsage(org.id),
            getIntelligenceUsage(org.id),
            prisma.billingEvent.findMany({
                where: { organizationId: org.id },
                orderBy: { createdAt: "desc" },
                take: 25,
            }),
            prisma.auditEvent.count({ where: { organizationId: org.id } }),
        ]);

        return res.status(200).json(successResponse({
            organizationId: org.id,
            planInfo: planInfoForOrg(org),
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
router.post("/checkout", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { plan = "PRO", billingCycle = "MONTHLY", addOns = [], successUrl, cancelUrl } = req.body;
        const orgId = req.body.organizationId || req.params.orgId;
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId is required"));

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

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
// webhook below). Grants entitlements through the billing service only.
router.post("/confirm", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { sessionId, plan = "PRO", billingCycle = "MONTHLY", addOns = [], organizationId } = req.body;
        const orgId = organizationId || req.params.orgId || req.body.orgId;
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId is required"));

        const { organization } = await finalizeSubscription({
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
            metadata: { sessionId, plan, billingCycle, addOns },
            ipAddress: clientIpFrom(req),
        });

        await notifyUser(req.user.id, {
            title: "Plan upgraded",
            message: `${organization.name} is now on the ${plan === "PRO" ? "Pro" : "Custom"} plan.`,
            type: "SYSTEM",
        });

        return res.status(200).json(successResponse({
            organization: { ...organization, planInfo: planInfoForOrg(organization) },
            entitlements: getOrgEntitlements(organization),
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
        });
        return res.status(200).json(successResponse({ organization: org }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to cancel subscription"));
    }
});

// POST /api/billing/downgrade/:orgId — dev/testing helper: drop back to FREE.
router.post("/downgrade/:orgId", requireOrgRole("OWNER"), async (req, res) => {
    try {
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