import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";
import { resources, roleSeeds, ensureRoles } from "../lib/permissions.js";

const router = Router();
router.use(authenticate);

async function assertWorkspaceAdmin(workspaceId, userId) {
    if (!workspaceId) return null;
    const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member && ["OWNER", "ADMIN"].includes(member.role) ? member : null;
}

async function getMatrix(workspaceId) {
    await ensureRoles(workspaceId);
    const dbRoles = await prisma.role.findMany({
        where: { workspaceId },
        include: { permissions: true },
        orderBy: { createdAt: "asc" },
    });

    const order = new Map(roleSeeds.map((role, index) => [role.name, index]));
    const sortedRoles = dbRoles.sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99));
    const permissions = {};

    for (const role of sortedRoles) {
        permissions[role.name] = {};
        for (const permission of role.permissions) {
            permissions[role.name][permission.resource] ||= [];
            permissions[role.name][permission.resource].push(permission.action);
        }
    }

    return {
        roles: sortedRoles.map((role) => role.name),
        resources,
        permissions,
    };
}

router.get("/", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const member = await assertWorkspaceAdmin(workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));

        return res.status(200).json(successResponse(await getMatrix(workspaceId)));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch roles"));
    }
});

router.patch("/", async (req, res) => {
    try {
        const { workspaceId, role, resource, action, enabled } = req.body;
        const member = await assertWorkspaceAdmin(workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        if (role === "Owner") return res.status(403).json(errorResponse("LOCKED_ROLE", "Owner permissions cannot be changed"));

        const foundResource = resources.find((item) => item.id === resource);
        if (!foundResource || !foundResource.actions.includes(action)) {
            return res.status(422).json(errorResponse("INVALID_PERMISSION", "Permission is invalid"));
        }

        await ensureRoles(workspaceId);
        const dbRole = await prisma.role.findFirst({ where: { workspaceId, name: role } });
        if (!dbRole) return res.status(422).json(errorResponse("INVALID_ROLE", "Role is invalid"));

        if (enabled) {
            await prisma.permission.upsert({
                where: { roleId_resource_action: { roleId: dbRole.id, resource, action } },
                update: {},
                create: { roleId: dbRole.id, resource, action },
            });
        } else {
            await prisma.permission.deleteMany({ where: { roleId: dbRole.id, resource, action } });
        }

        await notifyUser(req.user.id, {
            title: "Permission updated",
            message: `${role} ${enabled ? "can now" : "can no longer"} ${action} ${resource}.`,
            type: "SYSTEM",
        });

        return res.status(200).json(successResponse(await getMatrix(workspaceId)));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update permission"));
    }
});

export { router as rolesRouter };
