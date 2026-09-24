import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { enforceFeature } from "../lib/entitlements.js";
import { notifyUser } from "../services/notification.service.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

function ticketSummary(ticket) {
    return {
        id: ticket.id,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        slaDueAt: ticket.slaDueAt,
        createdAt: ticket.createdAt,
    };
}

// GET /api/support?organizationId=
router.get("/", async (req, res) => {
    try {
        const { organizationId } = req.query;
        if (!organizationId) {
            return res.status(422).json(errorResponse("ORGANIZATION_REQUIRED", "organizationId is required"));
        }
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
        });
        if (!membership) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You are not a member of this organization"));
        }
        if (!(await enforceFeature(req, res, organizationId, "dedicated_support"))) return;

        const tickets = await prisma.supportTicket.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return res.status(200).json(successResponse({ tickets: tickets.map(ticketSummary) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch support tickets"));
    }
});

// POST /api/support
router.post("/", async (req, res) => {
    try {
        const { organizationId, subject, message } = req.body;
        if (!organizationId || typeof subject !== "string" || typeof message !== "string") {
            return res.status(422).json(errorResponse("INVALID_INPUT", "organizationId, subject and message are required"));
        }
        if (!(await enforceFeature(req, res, organizationId, "dedicated_support"))) return;

        const cleanSubject = subject.trim().slice(0, 120);
        const cleanMessage = message.trim().slice(0, 4000);
        if (!cleanSubject || !cleanMessage) {
            return res.status(422).json(errorResponse("INVALID_INPUT", "Subject and message cannot be empty"));
        }

        // Dedicated-support promise: a 1-hour response window during business
        // hours. Recorded for triage even though no email transport exists yet.
        const ticket = await prisma.supportTicket.create({
            data: {
                organizationId,
                userId: req.user.id,
                subject: cleanSubject,
                message: cleanMessage,
                status: "OPEN",
                slaDueAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });

        await notifyUser(req.user.id, {
            title: "Support ticket received",
            message: `We've received "${cleanSubject}". Our priority support aims to respond within 1 business hour.`,
            type: "INFO",
            url: `/settings/support`,
        });
        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "support.ticket.created",
            resource: "organization",
            resourceId: organizationId,
            metadata: { ticketId: ticket.id, subject: cleanSubject },
            ipAddress: clientIpFrom(req),
        });

        return res.status(201).json(successResponse({ ticket: ticketSummary(ticket) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create support ticket"));
    }
});

export { router as supportRouter };