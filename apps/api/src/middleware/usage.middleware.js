import { prisma } from "../lib/prisma.js";
import { recordApiUsage } from "../lib/usage.js";

/**
 * Best-effort per-organization API usage tracking. Resolves the organization id
 * from whichever shape the request uses (params / query / body), then records a
 * request in the current month's ApiUsage counter. Never blocks or throws.
 */
export async function trackApiUsage(req, res, next) {
    try {
        let organizationId =
            req.params?.organizationId ||
            req.params?.orgId ||
            req.body?.organizationId ||
            req.query?.organizationId;

        if (!organizationId && req.params?.workspaceId) {
            const ws = await prisma.workspace.findUnique({
                where: { id: req.params.workspaceId },
                select: { organizationId: true },
            });
            organizationId = ws?.organizationId || null;
        }

        if (organizationId) {
            await recordApiUsage(organizationId);
        }
    } catch (error) {
        console.error("[usage] middleware error:", error.message);
    }
    next();
}