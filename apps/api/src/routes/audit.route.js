import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { enforceFeature } from "../lib/entitlements.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

// GET /api/audit?orgId=... — organization audit trail. Gated by the
// "audit_logs" CUSTOM add-on and Owner/Admin org role.
router.get("/", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const organizationId = req.query.orgId;
        if (!organizationId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "orgId is required"));

        const entitlements = await enforceFeature(req, res, organizationId, "audit_logs");
        if (!entitlements) return;

        const { action, resource, limit = 100 } = req.query;
        const take = Math.min(Math.max(Number(limit) || 100, 1), 200);
        const where = {
            organizationId,
            ...(action ? { action: String(action) } : {}),
            ...(resource ? { resource: String(resource) } : {}),
        };

        const [events, total] = await Promise.all([
            prisma.auditEvent.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take,
                include: { actor: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            }),
            prisma.auditEvent.count({ where: { organizationId } }),
        ]);

        // The audit trail also records that it was viewed.
        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "read",
            resource: "audit_logs",
            metadata: { viewedEvents: events.length },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ events, total }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to load audit logs"));
    }
});

export { router as auditRouter };