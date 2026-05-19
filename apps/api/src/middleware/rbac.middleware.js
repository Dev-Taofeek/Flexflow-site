import { prisma } from "./lib/prisma.js";
import { errorResponse } from "./utils/api-response.js";

export function authorize(resource, action) {
    return async function rbacMiddleware(req, res, next) {
        try {
            const userId = req.user?.id;
            const workspaceId =
                req.params.workspaceId ||
                req.body?.workspaceId ||
                req.query?.workspaceId;

            if (!userId) {
                return res
                    .status(401)
                    .json(
                        errorResponse(
                            "UNAUTHORIZED",
                            "You must be authenticated to access this resource",
                        ),
                    );
            }

            if (!workspaceId) {
                return res
                    .status(400)
                    .json(
                        errorResponse(
                            "WORKSPACE_REQUIRED",
                            "workspaceId is required for permission checks",
                        ),
                    );
            }

            const roleAssignment = await prisma.roleAssignment.findFirst({
                where: {
                    userId,
                    workspaceId,
                    role: {
                        permissions: {
                            some: {
                                resource,
                                action,
                            },
                        },
                    },
                },
                include: {
                    role: {
                        include: {
                            permissions: true,
                        },
                    },
                },
            });

            if (!roleAssignment) {
                return res
                    .status(403)
                    .json(
                        errorResponse(
                            "FORBIDDEN",
                            "You do not have permission to perform this action",
                        ),
                    );
            }

            req.permission = {
                resource,
                action,
                roleId: roleAssignment.roleId,
                roleName: roleAssignment.role.name,
            };

            next();
        } catch (error) {
            next(error);
        }
    };
}
