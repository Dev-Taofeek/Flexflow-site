import { errorResponse } from "../utils/api-response.js";
import { checkPermission, resolveWorkspaceId } from "../lib/permissions.js";

export function authorize(resource, action) {
    return async function rbacMiddleware(req, res, next) {
        try {
            const userId = req.user?.id;

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

            const workspaceId = await resolveWorkspaceId(req);

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

            const { allowed, member } = await checkPermission(workspaceId, userId, resource, action);

            if (!member) {
                return res
                    .status(403)
                    .json(errorResponse("FORBIDDEN", "Not a workspace member"));
            }

            if (!allowed) {
                return res
                    .status(403)
                    .json(
                        errorResponse(
                            "FORBIDDEN",
                            "You do not have permission to perform this action",
                        ),
                    );
            }

            req.workspaceMember = member;
            req.permission = { resource, action };

            next();
        } catch (error) {
            next(error);
        }
    };
}
