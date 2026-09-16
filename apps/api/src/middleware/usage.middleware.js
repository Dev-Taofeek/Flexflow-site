import { prisma } from "../lib/prisma.js";
import { recordApiUsage, isApiLimitExceeded } from "../lib/usage.js";
import { getOrgEntitlementsById } from "../lib/entitlements.js";
import { errorResponse } from "../utils/api-response.js";

// Mutating methods consume the tier's request allowance; read-only traffic is
// never blocked so users can still view data and reach their billing screen.
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Per-organization API usage tracking + plan enforcement. Resolves the
 * organization id from whichever shape the request uses (params / query /
 * body), records a request in the current month's ApiUsage counter, and short-
 * circuits mutating calls once the plan's monthly allowance is exhausted.
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

        if (!organizationId) return next();

        if (MUTATING_METHODS.has(req.method) && (await isApiLimitExceeded(organizationId))) {
            const entitlements = await getOrgEntitlementsById(organizationId).catch(() => null);
            if (res.headersSent) return next();
            return res.status(429).json({
                ...errorResponse("USAGE_LIMIT_REACHED", "You have reached your monthly API request limit for your plan."),
                data: {
                    code: "USAGE_LIMIT_REACHED",
                    resource: "apiRequests",
                    planId: entitlements?.planId || null,
                    upgradeAvailable: true,
                },
            });
        }

        await recordApiUsage(organizationId);
    } catch (error) {
        console.error("[usage] middleware error:", error.message);
    }
    next();
}