import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { enforceFeature } from "../lib/entitlements.js";
import { requireOrgRole } from "../lib/permissions.js";
import { notifyUser } from "../services/notification.service.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { buildOrgExport } from "../lib/data-export.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

/** Any organization member may read retention settings + export metadata. */
async function isMember(organizationId, userId) {
    const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
    });
    return Boolean(membership);
}

function exportSummary(row) {
    return {
        id: row.id,
        scope: row.scope,
        status: row.status,
        fileName: row.fileName,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
        requestedBy: row.requestedBy ? { id: row.requestedBy.id, name: row.requestedBy.name, email: row.requestedBy.email } : null,
    };
}

// GET /api/retention/organizations/:orgId/retention
router.get("/organizations/:organizationId/retention", async (req, res) => {
    try {
        const { organizationId } = req.params;
        if (!(await isMember(organizationId, req.user.id))) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You are not a member of this organization"));
        }
        if (!(await enforceFeature(req, res, organizationId, "data_retention"))) return;

        const [policy, exports] = await Promise.all([
            prisma.dataRetentionPolicy.findUnique({ where: { organizationId } }),
            prisma.dataExport.findMany({
                where: { organizationId },
                orderBy: { createdAt: "desc" },
                take: 50,
                include: { requestedBy: { select: { id: true, name: true, email: true } } },
            }),
        ]);

        return res.status(200).json(
            successResponse({
                policy: {
                    retentionDays: policy?.retentionDays ?? null,
                    backupEnabled: policy?.backupEnabled ?? false,
                    lastBackupAt: policy?.lastBackupAt ?? null,
                },
                exports: exports.map(exportSummary),
            }),
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch retention settings"));
    }
});

// PUT /api/retention/organizations/:orgId/retention
router.put("/organizations/:organizationId/retention", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        if (!(await enforceFeature(req, res, organizationId, "data_retention"))) return;

        let { retentionDays, backupEnabled } = req.body;
        if (retentionDays !== null && retentionDays !== undefined) {
            retentionDays = Number(retentionDays);
            if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
                return res.status(422).json(errorResponse("INVALID_INPUT", "retentionDays must be between 1 and 3650 days"));
            }
        } else {
            retentionDays = null;
        }
        if (typeof backupEnabled !== "boolean") backupEnabled = false;

        const policy = await prisma.dataRetentionPolicy.upsert({
            where: { organizationId },
            update: { retentionDays, backupEnabled },
            create: { organizationId, retentionDays, backupEnabled },
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "retention.policy.updated",
            resource: "organization",
            resourceId: organizationId,
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(
            successResponse({
                retentionDays: policy.retentionDays ?? null,
                backupEnabled: policy.backupEnabled,
                lastBackupAt: policy.lastBackupAt ?? null,
            }),
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to save retention settings"));
    }
});

// POST /api/retention/organizations/:orgId/export
router.post("/organizations/:organizationId/export", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        if (!(await enforceFeature(req, res, organizationId, "data_retention"))) return;

        const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
        if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const snapshot = await buildOrgExport(organizationId);
        if (!snapshot) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const serialized = JSON.stringify(snapshot);
        const fileName = `flexflow-export-${org.slug}-${new Date().toISOString().slice(0, 10)}.json`;

        const record = await prisma.dataExport.create({
            data: {
                organizationId,
                requestedById: req.user.id,
                scope: "FULL",
                status: "READY",
                fileName,
                data: snapshot,
                fileSize: Buffer.byteLength(serialized, "utf8"),
            },
        });

        await prisma.dataRetentionPolicy.upsert({
            where: { organizationId },
            update: { lastBackupAt: new Date() },
            create: { organizationId, lastBackupAt: new Date() },
        });

        await notifyUser(req.user.id, {
            title: "Data export ready",
            message: "Your organization data export is ready to download.",
            type: "SYSTEM",
        });
        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "retention.export.created",
            resource: "organization",
            resourceId: organizationId,
            metadata: { exportId: record.id, fileName },
            ipAddress: clientIpFrom(req),
        });

        return res.status(201).json(successResponse({ export: exportSummary(record) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create export"));
    }
});

// GET /api/retention/export/:exportId?organizationId=
router.get("/export/:exportId", async (req, res) => {
    try {
        const { exportId } = req.params;
        const { organizationId } = req.query;
        if (!organizationId) return res.status(422).json(errorResponse("ORGANIZATION_REQUIRED", "organizationId is required"));

        if (!(await isMember(organizationId, req.user.id))) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You are not a member of this organization"));
        }
        if (!(await enforceFeature(req, res, organizationId, "data_retention"))) return;

        const record = await prisma.dataExport.findFirst({ where: { id: exportId, organizationId } });
        if (!record || record.status !== "READY" || !record.data) {
            return res.status(404).json(errorResponse("NOT_FOUND", "Export not found or expired"));
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${record.fileName}"`);
        return res.send(JSON.stringify(record.data, null, 2));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to download export"));
    }
});

export { router as retentionRouter };