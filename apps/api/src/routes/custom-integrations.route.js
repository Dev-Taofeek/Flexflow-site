import crypto from "crypto";
import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { enforceFeature } from "../lib/entitlements.js";
import { requireOrgRole } from "../lib/permissions.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { encryptSecret } from "../lib/crypto.js";
import { clientIpFrom, recordAudit } from "../lib/audit.js";
import { OUTBOUND_EVENTS, deliverOutboundWebhooks } from "../services/outbound.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

function publicWebhookUrl(orgToken) {
    const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
    return `${base}/api/integrations/webhooks/webhooks/custom/${orgToken}`;
}

async function membershipFor(req, organizationId) {
    return prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: req.user.id } },
        select: { id: true, role: true },
    });
}

async function tokenForOrg(organizationId) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { customIncomingToken: true },
    });
    if (!org) throw null;
    if (org.customIncomingToken) return org.customIncomingToken;
    const token = crypto.randomBytes(24).toString("hex");
    await prisma.organization.update({ where: { id: organizationId }, data: { customIncomingToken: token } });
    return token;
}

router.get("/organizations/:organizationId/incoming", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await membershipFor(req, organizationId);
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const token = await tokenForOrg(organizationId);
        return res.status(200).json(successResponse({ url: publicWebhookUrl(token), token, events: OUTBOUND_EVENTS }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to load incoming webhook"));
    }
});

router.post("/organizations/:organizationId/incoming/rotate", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const token = crypto.randomBytes(24).toString("hex");
        await prisma.organization.update({ where: { id: organizationId }, data: { customIncomingToken: token } });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "CUSTOM_WEBHOOK_TOKEN_ROTATED",
            resource: "custom-integrations",
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ url: publicWebhookUrl(token), token }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to rotate incoming token"));
    }
});

router.get("/organizations/:organizationId/outbound", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await membershipFor(req, organizationId);
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const webhooks = await prisma.outboundWebhook.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true, name: true, url: true, events: true, enabled: true,
                createdAt: true, updatedAt: true, lastDeliveryAt: true, lastStatus: true,
            },
        });

        return res.status(200).json(successResponse({ webhooks, events: OUTBOUND_EVENTS }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch outbound webhooks"));
    }
});

router.post("/organizations/:organizationId/outbound", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const { name, url, events, secret } = req.body;
        if (typeof name !== "string" || !name.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "name is required"));
        }
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "url must be a valid http(s) URL"));
        }
        const selectedEvents = Array.isArray(events)
            ? events.filter((e) => OUTBOUND_EVENTS.includes(e))
            : [];
        if (selectedEvents.length === 0) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Select at least one event"));
        }

        const webhook = await prisma.outboundWebhook.create({
            data: {
                organizationId,
                name: name.trim().slice(0, 80),
                url: url.trim(),
                events: selectedEvents,
                enabled: true,
                ...(secret ? { secret: encryptSecret(String(secret).trim()) } : {}),
                createdById: req.user.id,
            },
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "OUTBOUND_WEBHOOK_CREATED",
            resource: "outbound-webhook",
            resourceId: webhook.id,
            ipAddress: clientIpFrom(req),
        });

        return res.status(201).json(successResponse({
            webhook: {
                id: webhook.id, name: webhook.name, url: webhook.url, events: webhook.events,
                enabled: webhook.enabled, createdAt: webhook.createdAt,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create outbound webhook"));
    }
});

router.patch("/organizations/:organizationId/outbound/:outboundId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, outboundId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const existing = await prisma.outboundWebhook.findFirst({
            where: { id: outboundId, organizationId },
            select: { id: true, events: true },
        });
        if (!existing) return res.status(404).json(errorResponse("NOT_FOUND", "Outbound webhook not found"));

        const { name, url, events, enabled, secret } = req.body;
        const data = {};
        if (typeof name === "string" && name.trim()) data.name = name.trim().slice(0, 80);
        if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) data.url = url.trim();
        if (Array.isArray(events)) {
            const filtered = events.filter((e) => OUTBOUND_EVENTS.includes(e));
            if (filtered.length === 0) {
                return res.status(422).json(errorResponse("VALIDATION_ERROR", "Select at least one event"));
            }
            data.events = filtered;
        }
        if (typeof enabled === "boolean") data.enabled = enabled;
        if (typeof secret === "string" && secret.trim()) data.secret = encryptSecret(secret.trim());

        const webhook = await prisma.outboundWebhook.update({ where: { id: outboundId }, data });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "OUTBOUND_WEBHOOK_UPDATED",
            resource: "outbound-webhook",
            resourceId: webhook.id,
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({
            webhook: {
                id: webhook.id, name: webhook.name, url: webhook.url, events: webhook.events,
                enabled: webhook.enabled, lastDeliveryAt: webhook.lastDeliveryAt, lastStatus: webhook.lastStatus,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update outbound webhook"));
    }
});

router.delete("/organizations/:organizationId/outbound/:outboundId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, outboundId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const existing = await prisma.outboundWebhook.findFirst({
            where: { id: outboundId, organizationId },
            select: { id: true },
        });
        if (!existing) return res.status(404).json(errorResponse("NOT_FOUND", "Outbound webhook not found"));

        await prisma.outboundWebhook.delete({ where: { id: outboundId } });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "OUTBOUND_WEBHOOK_DELETED",
            resource: "outbound-webhook",
            resourceId: outboundId,
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete outbound webhook"));
    }
});

router.post("/organizations/:organizationId/outbound/:outboundId/test", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, outboundId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "custom_integrations");
        if (!entitlements) return;

        const webhook = await prisma.outboundWebhook.findFirst({
            where: { id: outboundId, organizationId },
            select: { id: true, events: true },
        });
        if (!webhook) return res.status(404).json(errorResponse("NOT_FOUND", "Outbound webhook not found"));

        await deliverOutboundWebhooks({
            organizationId,
            eventType: webhook.events?.[0] || "task.created",
            payload: { test: true, sent_by: { id: req.user.id } },
        });
        const after = await prisma.outboundWebhook.findUnique({
            where: { id: outboundId },
            select: { lastStatus: true, lastDeliveryAt: true },
        });
        return res.status(200).json(successResponse({ delivered: after?.lastStatus === "SUCCESS", status: after?.lastStatus, lastDeliveryAt: after?.lastDeliveryAt }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send test delivery"));
    }
});

export { router as customIntegrationsRouter };