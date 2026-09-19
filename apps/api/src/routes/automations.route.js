import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { trackApiUsage } from "../middleware/usage.middleware.js";
import { requireWorkspaceRole } from "../lib/permissions.js";
import { enforceFeature } from "../lib/entitlements.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);
router.use(trackApiUsage);

const VALID_ACTIONS = ["task_status", "comment", "notify", "link"];

function assertWorkspaceBelongsToOrg(workspaceId, organizationId) {
    return prisma.workspace.findFirst({
        where: { id: workspaceId, organizationId },
        select: { id: true },
    });
}

// Resolve the owning organization from the workspace row so callers can never
// point reads at an org they don't belong to via the query string.
async function organizationForWorkspace(workspaceId) {
    const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { organizationId: true },
    });
    return ws?.organizationId || null;
}

// ── Automation rules ─────────────────────────────────────────────────────────

router.get("/automations", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const organizationId = await organizationForWorkspace(workspaceId);
        if (!organizationId) return res.status(403).json(errorResponse("FORBIDDEN", "Workspace not found"));

        const rules = await prisma.automationRule.findMany({
            where: { organizationId, workspaceId },
            orderBy: { createdAt: "asc" },
        });
        return res.status(200).json(successResponse(rules));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to list automations"));
    }
});

router.post("/automations", requireWorkspaceRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, workspaceId, provider, trigger, condition, action, actionConfig, enabled = true } = req.body;
        if (!organizationId || !workspaceId || !provider || !trigger || !action) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId, workspaceId, provider, trigger and action are required"));
        }
        if (!VALID_ACTIONS.includes(action)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid automation action"));
        }
        const ws = await assertWorkspaceBelongsToOrg(workspaceId, organizationId);
        if (!ws) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Workspace does not belong to the organization"));

        // Forbids duplicate (provider, trigger) rules in a workspace.
        await prisma.automationRule.create({
            data: {
                organizationId,
                workspaceId,
                provider,
                trigger,
                condition: condition || undefined,
                action,
                actionConfig: actionConfig || undefined,
                enabled: Boolean(enabled),
                createdById: req.user.id,
            },
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "create",
            resource: "automation",
            metadata: { provider, trigger, action },
            ipAddress: clientIpFrom(req),
        });

        return res.status(201).json(successResponse({ created: true }));
    } catch (error) {
        if (error?.code === "P2002") {
            return res.status(409).json(errorResponse("DUPLICATE_RULE", "An automation for this trigger already exists in this workspace"));
        }
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create automation"));
    }
});

router.patch("/automations/:id", requireWorkspaceRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const workspaceId = req.body.workspaceId || req.query.workspaceId;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, workspaceId } });
        if (!rule) return res.status(404).json(errorResponse("NOT_FOUND", "Automation not found"));

        const { action, actionConfig, condition, enabled, trigger } = req.body;
        if (action && !VALID_ACTIONS.includes(action)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid automation action"));
        }

        const updated = await prisma.automationRule.update({
            where: { id: rule.id },
            data: {
                ...(action ? { action } : {}),
                ...(actionConfig !== undefined ? { actionConfig } : {}),
                ...(condition !== undefined ? { condition } : {}),
                ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
                ...(trigger ? { trigger } : {}),
            },
        });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update automation"));
    }
});

router.delete("/automations/:id", requireWorkspaceRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, workspaceId } });
        if (!rule) return res.status(404).json(errorResponse("NOT_FOUND", "Automation not found"));

        await prisma.automationRule.delete({ where: { id: rule.id } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete automation"));
    }
});

// ── Connector mappings ───────────────────────────────────────────────────────

router.get("/mappings", async (req, res) => {
    try {
        const { orgId, workspaceId } = req.query;
        if (!orgId || !workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "orgId and workspaceId are required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const mappings = await prisma.connectorMapping.findMany({
            where: { organizationId: orgId, workspaceId },
            include: { project: { select: { id: true, name: true } }, task: { select: { id: true, key: true, title: true } } },
            orderBy: { createdAt: "asc" },
        });
        return res.status(200).json(successResponse(mappings));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to list mappings"));
    }
});

router.post("/mappings", requireWorkspaceRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, workspaceId, provider, externalResourceType, externalResourceId, projectId, taskId, config } = req.body;
        if (!organizationId || !workspaceId || !provider || !externalResourceType || !externalResourceId) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId, workspaceId, provider, resource type and resource id are required"));
        }
        const ws = await assertWorkspaceBelongsToOrg(workspaceId, organizationId);
        if (!ws) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Workspace does not belong to the organization"));

        await prisma.connectorMapping.create({
            data: {
                organizationId,
                workspaceId,
                provider,
                externalResourceType,
                externalResourceId,
                projectId: projectId || null,
                taskId: taskId || null,
                config: config || undefined,
            },
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "create",
            resource: "connector_mapping",
            metadata: { provider, externalResourceType, externalResourceId },
            ipAddress: clientIpFrom(req),
        });

        return res.status(201).json(successResponse({ created: true }));
    } catch (error) {
        if (error?.code === "P2002") {
            return res.status(409).json(errorResponse("ALREADY_MAPPED", "This resource is already mapped in an organization"));
        }
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create mapping"));
    }
});

router.delete("/mappings/:id", requireWorkspaceRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const mapping = await prisma.connectorMapping.findFirst({ where: { id: req.params.id, workspaceId } });
        if (!mapping) return res.status(404).json(errorResponse("NOT_FOUND", "Mapping not found"));

        await prisma.connectorMapping.delete({ where: { id: mapping.id } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete mapping"));
    }
});

export { router as automationsRouter };