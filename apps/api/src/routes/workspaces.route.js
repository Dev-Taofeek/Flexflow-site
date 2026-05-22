import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

router.post("/", async (req, res) => {
    try {
        const { organizationId, name, description } = req.body;
        if (!organizationId || !name?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId and name are required"));
        }

        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
        });
        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const baseSlug = slugify(name);
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.workspace.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter++}`;
        }

        const workspace = await prisma.workspace.create({
            data: {
                organizationId,
                name: name.trim(),
                slug,
                description: description?.trim() || null,
                members: { create: { userId: req.user.id, role: "OWNER" } },
            },
            include: { _count: { select: { members: true, projects: true } } },
        });

        return res.status(201).json(successResponse(workspace));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create workspace"));
    }
});

router.get("/:workspaceId", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const workspace = await prisma.workspace.findUnique({
            where: { id: req.params.workspaceId },
            include: {
                members: {
                    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
                    orderBy: { createdAt: "asc" },
                },
                projects: { orderBy: { updatedAt: "desc" } },
                _count: { select: { members: true, projects: true } },
            },
        });

        return res.status(200).json(successResponse({ ...workspace, role: member.role }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch workspace"));
    }
});

router.patch("/:workspaceId", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { name, description } = req.body;
        const workspace = await prisma.workspace.update({
            where: { id: req.params.workspaceId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
            },
        });

        return res.status(200).json(successResponse(workspace));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update workspace"));
    }
});

router.delete("/:workspaceId", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member || member.role !== "OWNER") {
            return res.status(403).json(errorResponse("FORBIDDEN", "Only the owner can delete a workspace"));
        }

        await prisma.workspace.delete({ where: { id: req.params.workspaceId } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete workspace"));
    }
});

// GET /api/workspaces/:workspaceId/members
router.get("/:workspaceId/members", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId: req.params.workspaceId },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" },
        });
        return res.status(200).json(successResponse({ members }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch members"));
    }
});

router.post("/:workspaceId/members", async (req, res) => {
    try {
        const actor = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!actor || !["OWNER", "ADMIN"].includes(actor.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { userId, role = "MEMBER" } = req.body;
        const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });

        const orgMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: workspace.organizationId, userId } },
        });
        if (!orgMember) return res.status(400).json(errorResponse("NOT_ORG_MEMBER", "User must be in the organization first"));

        const existing = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId } },
        });
        if (existing) return res.status(409).json(errorResponse("ALREADY_MEMBER", "User already in workspace"));

        const member = await prisma.workspaceMember.create({
            data: { workspaceId: req.params.workspaceId, userId, role },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });

        return res.status(201).json(successResponse(member));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to add member"));
    }
});

router.delete("/:workspaceId/members/:userId", async (req, res) => {
    try {
        const actor = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!actor || !["OWNER", "ADMIN"].includes(actor.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        await prisma.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.params.userId } },
        });

        return res.status(200).json(successResponse({ removed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove member"));
    }
});

// GET /api/workspaces/:workspaceId/labels
router.get("/:workspaceId/labels", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const labels = await prisma.label.findMany({
            where: { workspaceId: req.params.workspaceId },
            orderBy: { createdAt: "asc" },
        });
        return res.status(200).json(successResponse(labels));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch labels"));
    }
});

// POST /api/workspaces/:workspaceId/labels
router.post("/:workspaceId/labels", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { name, color } = req.body;
        if (!name?.trim() || !color) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "name and color are required"));
        }

        const label = await prisma.label.create({
            data: { workspaceId: req.params.workspaceId, name: name.trim(), color },
        });
        return res.status(201).json(successResponse(label));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create label"));
    }
});

// DELETE /api/workspaces/:workspaceId/labels/:labelId
router.delete("/:workspaceId/labels/:labelId", async (req, res) => {
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.user.id } },
        });
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        await prisma.label.delete({ where: { id: req.params.labelId } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete label"));
    }
});

export { router as workspacesRouter };
