import { prisma } from "./prisma.js";

/**
 * Records an AuditEvent for the organization. Best-effort and non-fatal: audit
 * logging must never break the action it describes.
 */
export async function recordAudit({
    organizationId,
    actorId = null,
    action,
    resource,
    resourceId = null,
    metadata = null,
    ipAddress = null,
}) {
    if (!organizationId || !action || !resource) return;
    try {
        await prisma.auditEvent.create({
            data: {
                organizationId,
                actorId: actorId || undefined,
                action,
                resource,
                resourceId: resourceId || undefined,
                metadata: metadata ?? undefined,
                ipAddress: ipAddress || undefined,
            },
        });
    } catch (error) {
        console.error("[audit] failed to record event:", error.message);
    }
}

/** Client IP from an Express request (handles common proxies best-effort). */
export function clientIpFrom(req) {
    return (
        req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        null
    );
}