import { prisma } from "./prisma.js";
import { errorResponse } from "../utils/api-response.js";

export const resources = [
    { id: "projects", label: "Projects", actions: ["create", "read", "update", "delete"] },
    { id: "tasks", label: "Tasks", actions: ["create", "read", "update", "delete"] },
    { id: "comments", label: "Comments", actions: ["create", "read", "update", "delete"] },
    { id: "team", label: "Team", actions: ["invite", "read", "update", "remove"] },
    { id: "settings", label: "Settings", actions: ["read", "update", "billing", "danger_zone"] },
    { id: "roles", label: "Roles & Permissions", actions: ["read", "update"] },
];

export const roleSeeds = [
    {
        name: "Owner",
        permissions: {
            projects: ["create", "read", "update", "delete"],
            tasks: ["create", "read", "update", "delete"],
            comments: ["create", "read", "update", "delete"],
            team: ["invite", "read", "update", "remove"],
            settings: ["read", "update", "billing", "danger_zone"],
            roles: ["read", "update"],
        },
    },
    {
        name: "Admin",
        permissions: {
            projects: ["create", "read", "update", "delete"],
            tasks: ["create", "read", "update", "delete"],
            comments: ["create", "read", "update", "delete"],
            team: ["invite", "read", "update"],
            settings: ["read", "update"],
            roles: ["read"],
        },
    },
    {
        name: "Member",
        permissions: {
            projects: ["read"],
            tasks: ["read"],
            comments: ["create", "read", "update"],
            team: ["read"],
            settings: ["read"],
            roles: [],
        },
    },
    {
        name: "Viewer",
        permissions: {
            projects: ["read"],
            tasks: ["read"],
            comments: ["read"],
            team: ["read"],
            settings: ["read"],
            roles: [],
        },
    },
];

// Maps the simple OrgRole enum (used on WorkspaceMember) to the seeded
// per-workspace Role rows that hold the customizable permission matrix.
export const ORG_ROLE_TO_ROLE_NAME = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
    VIEWER: "Viewer",
};

export async function ensureRoles(workspaceId) {
    for (const seed of roleSeeds) {
        let role = await prisma.role.findFirst({
            where: { workspaceId, name: seed.name },
            orderBy: { createdAt: "asc" },
        });

        if (!role) {
            role = await prisma.role.create({
                data: {
                    workspaceId,
                    name: seed.name,
                    isSystemRole: true,
                },
            });
        }

        const existing = await prisma.permission.count({ where: { roleId: role.id } });
        if (existing === 0) {
            const data = Object.entries(seed.permissions).flatMap(([resource, actions]) =>
                actions.map((action) => ({ roleId: role.id, resource, action })),
            );
            if (data.length > 0) {
                await prisma.permission.createMany({ data, skipDuplicates: true });
            }
        }
    }
}

// Resolves a workspaceId for a request that may identify the workspace
// directly, or only via a project or task.
export async function resolveWorkspaceId(req) {
    const direct = req.params.workspaceId || req.body?.workspaceId || req.query?.workspaceId;
    if (direct) return direct;

    if (req.params.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: req.params.projectId },
            select: { workspaceId: true },
        });
        return project?.workspaceId || null;
    }

    if (req.params.taskId) {
        const task = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { project: { select: { workspaceId: true } } },
        });
        return task?.project?.workspaceId || null;
    }

    if (req.body?.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: req.body.projectId },
            select: { workspaceId: true },
        });
        return project?.workspaceId || null;
    }

    return null;
}

// Checks whether the given user has permission to perform `action` on
// `resource` within `workspaceId`, based on the workspace's permission
// matrix (Role/Permission rows seeded from roleSeeds, customizable via
// Settings > Roles).
export async function checkPermission(workspaceId, userId, resource, action) {
    if (!workspaceId || !userId) return { allowed: false, member: null };

    const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) return { allowed: false, member: null };

    const roleName = ORG_ROLE_TO_ROLE_NAME[member.role];
    if (!roleName) return { allowed: false, member };

    await ensureRoles(workspaceId);

    const role = await prisma.role.findFirst({
        where: { workspaceId, name: roleName },
        include: { permissions: true },
    });

    const allowed = Boolean(
        role?.permissions.some((p) => p.resource === resource && p.action === action),
    );

    return { allowed, member, role };
}

// Centralized check for the simple per-workspace OrgRole hierarchy
// (used for member/invite/label management endpoints).
export function requireWorkspaceRole(...roles) {
    return async function workspaceRoleMiddleware(req, res, next) {
        try {
            const userId = req.user?.id;
            const workspaceId = req.params.workspaceId || req.body?.workspaceId || req.query?.workspaceId;

            if (!userId || !workspaceId) {
                return res.status(400).json(errorResponse("WORKSPACE_REQUIRED", "workspaceId is required"));
            }

            const member = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId } },
            });

            if (!member || !roles.includes(member.role)) {
                return res
                    .status(403)
                    .json(errorResponse("FORBIDDEN", "You do not have permission to perform this action"));
            }

            req.workspaceMember = member;
            next();
        } catch (error) {
            next(error);
        }
    };
}

// Centralized check for organization-level roles (OrganizationMember.role).
export function requireOrgRole(...roles) {
    return async function orgRoleMiddleware(req, res, next) {
        try {
            const userId = req.user?.id;
            const organizationId =
                req.params.organizationId || req.params.orgId || req.body?.organizationId || req.query?.organizationId;

            if (!userId || !organizationId) {
                return res.status(400).json(errorResponse("ORGANIZATION_REQUIRED", "organizationId is required"));
            }

            const membership = await prisma.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId, userId } },
            });

            if (!membership || !roles.includes(membership.role)) {
                return res
                    .status(403)
                    .json(errorResponse("FORBIDDEN", "You do not have permission to perform this action"));
            }

            req.organizationMember = membership;
            next();
        } catch (error) {
            next(error);
        }
    };
}
