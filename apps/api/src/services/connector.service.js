import { prisma } from "../lib/prisma.js";
import { decryptSecret } from "../lib/crypto.js";
import { extractTaskKeys } from "../lib/task-key.js";
import { notifyUser } from "./notification.service.js";

/**
 * Connector service — webhook ingestion, task-key linking, and automation
 * execution for GitHub / Slack / Figma.
 *
 * Flow for every incoming provider event:
 *   1. Resolve a ConnectorMapping (provider + resource type + resource id) so
 *      the event is never applied to a workspace that didn't map the resource.
 *   2. Persist the event exactly once (unique [provider, externalEventId]).
 *   3. Run enabled AutomationRules for that provider/trigger in the workspace.
 *   4. Mark the event PROCESSED (or FAILED on error).
 */

export async function getProviderConnection(organizationId, provider) {
    const conn = await prisma.integrationConnection.findFirst({
        where: { organizationId, provider, enabled: true },
        select: { id: true, config: true },
    });
    if (!conn?.config?.encryptedToken) return null;
    return { id: conn.id, token: decryptSecret(conn.config.encryptedToken), config: conn.config };
}

/** Find the workspace mapping for an external resource. */
export async function findMapping({ provider, externalResourceType, externalResourceId }) {
    if (!provider || !externalResourceType || !externalResourceId) return null;
    return prisma.connectorMapping.findFirst({
        where: { provider, externalResourceType, externalResourceId },
    });
}

/**
 * Idempotently record + process a provider event against a mapped workspace.
 * Returns { handled, duplicate, event, mapping }.
 */
export async function ingestConnectorEvent({
    provider,
    externalEventId,
    eventType,
    externalResourceType,
    externalResourceId,
    externalUserId,
    payload = {},
    occurredAt = new Date(),
}) {
    const mapping = await findMapping({ provider, externalResourceType, externalResourceId });
    if (!mapping) return { handled: false, duplicate: false, event: null, mapping: null };

    const existing = await prisma.connectorEvent.findUnique({
        where: { provider_externalEventId: { provider, externalEventId } },
    })
        .catch(() => null);
    if (existing) return { handled: true, duplicate: true, event: existing, mapping };

    const event = await prisma.connectorEvent.create({
        data: {
            organizationId: mapping.organizationId,
            workspaceId: mapping.workspaceId,
            provider,
            externalEventId,
            eventType,
            externalResourceId,
            externalUserId,
            payload,
            occurredAt,
        },
    }).catch((error) => {
        if (error?.code === "P2002") return null; // concurrent duplicate delivery
        throw error;
    });

    if (!event) return { handled: true, duplicate: true, event: null, mapping };

    return { handled: true, duplicate: false, event, mapping };
}

export async function markEventProcessed(eventId, error = null) {
    if (!eventId) return;
    await prisma.connectorEvent.update({
        where: { id: eventId },
        data: {
            status: error ? "FAILED" : "PROCESSED",
            processedAt: new Date(),
            error: error ? String(error).slice(0, 500) : null,
        },
    }).catch(() => {});
}

/** Extract task keys referenced by an event payload and link them. */
export async function linkTaskKeys({ workspaceId, organizationId, provider, eventId, keys = [] }) {
    if (keys.length === 0) return [];
    const tasks = await prisma.task.findMany({
        where: { workspaceId, key: { in: keys } },
        select: { id: true, key: true, title: true, projectId: true, assignee: { select: { id: true } } },
    });
    if (tasks.length === 0) return [];

    await prisma.connectorMapping.createMany({
        data: tasks.map((task) => ({
            organizationId,
            workspaceId,
            provider,
            externalResourceType: "external_event",
            externalResourceId: `${provider}:${eventId}:${task.id}`,
            taskId: task.id,
        })),
        skipDuplicates: true,
    }).catch(() => {});

    return tasks;
}

async function logActivity(mapping, { actorId, taskId, projectId, action }) {
    if (!actorId) return; // ActivityLog.userId is required; skip actor-less entries
    await prisma.activityLog.create({
        data: {
            userId: actorId,
            workspaceId: mapping.workspaceId,
            projectId: projectId || null,
            taskId: taskId || null,
            action,
            entityType: "connector",
            entityId: taskId || null,
        },
    }).catch(() => {});
}

/** Apply enabled workflow automations for a provider/trigger. */
export async function applyAutomations({ provider, trigger, event, mapping, text }) {
    const rules = await prisma.automationRule.findMany({
        where: { provider, trigger, workspaceId: mapping.workspaceId, enabled: true },
    });
    if (rules.length === 0) return { applied: [], notifyIds: [] };

    const notifyIds = new Set();
    const applied = [];

    for (const rule of rules) {
        const keys = extractTaskKeys(text || "");
        const tasks = await linkTaskKeys({
            workspaceId: mapping.workspaceId,
            organizationId: mapping.organizationId,
            provider,
            eventId: event.id,
            keys,
        });

        if (rule.action === "task_status") {
            const status = rule.actionConfig?.status;
            if (status && tasks.length > 0) {
                const taskIds = tasks.map((t) => t.id);
                await prisma.task.updateMany({
                    where: { id: { in: taskIds } },
                    data: { status, completedAt: status === "DONE" ? new Date() : null },
                });
                for (const task of tasks) {
                    await logActivity(mapping, { taskId: task.id, projectId: task.projectId, action: `automation set status to ${status} (${trigger})` });
                    if (task.assignee?.id) notifyIds.add(task.assignee.id);
                }
            }
            applied.push("task_status");
        } else if (rule.action === "comment") {
            const message = String(rule.actionConfig?.message || `Automation: ${trigger}`).slice(0, 280);
            for (const task of tasks) {
                await prisma.comment.create({ data: { taskId: task.id, authorId: null, content: message } });
                await logActivity(mapping, { taskId: task.id, projectId: task.projectId, action: `automation commented (${trigger})` });
            }
            applied.push("comment");
        } else if (rule.action === "notify") {
            const admins = await prisma.workspaceMember.findMany({
                where: { workspaceId: mapping.workspaceId, role: { in: ["OWNER", "ADMIN"] } },
                select: { userId: true },
            });
            for (const m of admins) notifyIds.add(m.userId);
            applied.push("notify");
        } else if (rule.action === "link") {
            applied.push("link");
        }
    }

    return { applied, notifyIds: [...notifyIds] };
}

/** Notify users about a connector event (deduped per event + user). */
export async function notifyConnectorUsers({ userIds, provider, eventId, title, message }) {
    await Promise.all(
        userIds.map((userId) =>
            notifyUser(userId, {
                title,
                message,
                type: "CONNECTOR",
                dedupeKey: `${provider}:${eventId}:${userId}`,
            }),
        ),
    );
}