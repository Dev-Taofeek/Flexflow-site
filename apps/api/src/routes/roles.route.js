import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/rbac.middleware.js";
import { enforceFeature } from "../lib/entitlements.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";
import { resources, roleSeeds, ensureRoles, checkPermission } from "../lib/permissions.js";

const router = Router();
router.use(authenticate);

function getMatrix(workspaceId) {
    return (async () => {
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
            roleMeta: Object.fromEntries(
                sortedRoles.map((role) => [
                    role.name,
                    { id: role.id, isSystemRole: role.isSystemRole, description: role.description || null },
                ]),
            ),
            resources,
            permissions,
        };
    })();
}

router.get("/", authorize("roles", "read"), async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const { allowed: canEdit } = await checkPermission(workspaceId, req.user.id, "roles", "update");

        return res.status(200).json(successResponse({ ...(await getMatrix(workspaceId)), canEdit }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch roles"));
    }
});

router.patch("/", authorize("roles", "update"), async (req, res) => {
    try {
        const { workspaceId, role, resource, action, enabled } = req.body;
        if (role === "Owner") return res.status(403).json(errorResponse("LOCKED_ROLE", "Owner permissions cannot be changed"));

        // Editing the permission matrix is a paid entitlement: PRO can tune the
        // built-in matrix; CUSTOM adds unlimited custom roles on top.
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!workspace) return res.status(404).json(errorResponse("NOT_FOUND", "Workspace not found"));
        const entitlements = await enforceFeature(req, res, workspace.organizationId, "customizable_permissions");
        if (!entitlements) return;

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

/** Validates + normalizes a permission map into [resource, action] pairs. */
function normalizePermissionSet(permissions) {
    const pairs = [];
    for (const [resource, actions] of Object.entries(permissions || {})) {
        const found = resources.find((item) => item.id === resource);
        if (!found) return { error: `Unknown resource "${resource}"` };
        if (!Array.isArray(actions)) return { error: `Permissions for "${resource}" must be an array` };
        for (const action of actions) {
            if (!found.actions.includes(action)) {
                return { error: `"${action}" is not a valid action for "${resource}"` };
            }
            pairs.push([resource, action]);
        }
    }
    return { pairs };
}

// Enforces both plan gates required to design custom roles: the permission
// editor (PRO base) and the custom-role builder (CUSTOM add-on).
async function requireRoleBuilderAccess(req, res, workspaceId) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
        res.status(404).json(errorResponse("NOT_FOUND", "Workspace not found"));
        return null;
    }
    if (!(await enforceFeature(req, res, workspace.organizationId, "customizable_permissions"))) return null;
    if (!(await enforceFeature(req, res, workspace.organizationId, "custom_roles"))) return null;
    return workspace;
}

router.post("/", authorize("roles", "update"), async (req, res) => {
    try {
        const { workspaceId, name, description } = req.body;
        if (!workspaceId || typeof name !== "string") {
            return res.status(422).json(errorResponse("INVALID_INPUT", "name and workspaceId are required"));
        }

        const workspace = await requireRoleBuilderAccess(req, res, workspaceId);
        if (!workspace) return;

        const cleanName = name.trim().replace(/\s+/g, " ");
        if (cleanName.length < 2 || cleanName.length > 40) {
            return res.status(422).json(errorResponse("INVALID_ROLE_NAME", "Role name must be between 2 and 40 characters"));
        }
        if (!/^[\p{L}\p{N}][\p{L}\p{N}\-_ ]*$/u.test(cleanName)) {
            return res.status(422).json(errorResponse("INVALID_ROLE_NAME", "Role names can only use letters, numbers, spaces, dashes and underscores"));
        }
        if (roleSeeds.some((seed) => seed.name.toLowerCase() === cleanName.toLowerCase()) || cleanName.toLowerCase() === "owner") {
            return res.status(422).json(errorResponse("INVALID_ROLE_NAME", `"${cleanName}" is a reserved role name`));
        }

        const { error, pairs } = normalizePermissionSet(req.body.permissions);
        if (error) return res.status(422).json(errorResponse("INVALID_PERMISSION", error));

        const existing = await prisma.role.findFirst({ where: { workspaceId, name: cleanName } });
        if (existing) {
            return res.status(409).json(errorResponse("ROLE_EXISTS", `A role named "${cleanName}" already exists in this workspace`));
        }

        const role = await prisma.role.create({
            data: {
                workspaceId,
                name: cleanName,
                description: typeof description === "string" && description.trim() ? description.trim().slice(0, 300) : null,
                isSystemRole: false,
                permissions: {
                    create: pairs.map(([resource, action]) => ({ resource, action })),
                },
            },
        });

        await notifyUser(req.user.id, {
            title: "Role created",
            message: `Custom role "${cleanName}" was created with ${pairs.length} permission(s).`,
            type: "SYSTEM",
        });

        return res.status(201).json(successResponse({ roleId: role.id, ...(await getMatrix(workspaceId)) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create role"));
    }
});

router.delete("/:roleId", authorize("roles", "update"), async (req, res) => {
    try {
        const { workspaceId } = req.body;
        const { roleId } = req.params;
        if (!workspaceId || !roleId) {
            return res.status(422).json(errorResponse("INVALID_INPUT", "roleId and workspaceId are required"));
        }

        const workspace = await requireRoleBuilderAccess(req, res, workspaceId);
        if (!workspace) return;

        const role = await prisma.role.findFirst({ where: { id: roleId, workspaceId } });
        if (!role) return res.status(404).json(errorResponse("NOT_FOUND", "Role not found"));
        if (role.isSystemRole) {
            return res.status(403).json(errorResponse("LOCKED_ROLE", "System roles cannot be deleted"));
        }

        await prisma.role.delete({ where: { id: role.id } });

        await notifyUser(req.user.id, {
            title: "Role deleted",
            message: `Custom role "${role.name}" was deleted.`,
            type: "SYSTEM",
        });

        return res.status(200).json(successResponse(await getMatrix(workspaceId)));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete role"));
    }
});

export { router as rolesRouter };
