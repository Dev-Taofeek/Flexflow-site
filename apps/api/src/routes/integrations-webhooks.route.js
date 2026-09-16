import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import {
    verifySignature256,
    verifySlackSignature,
    verifyFigmaPasscode,
} from "../lib/webhook-security.js";
import { extractTaskKeys } from "../lib/task-key.js";
import {
    ingestConnectorEvent,
    markEventProcessed,
    applyAutomations,
    notifyConnectorUsers,
} from "../services/connector.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

function rawText(req) {
    return Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
}

function parseRaw(req) {
    try {
        return JSON.parse(rawText(req));
    } catch {
        return null;
    }
}

function ack(res) {
    return res.status(200).json(successResponse({ handled: true }));
}

async function linkedTasksFor(mapping, keys) {
    if (keys.length === 0) return [];
    return prisma.task.findMany({
        where: { workspaceId: mapping.workspaceId, key: { in: keys } },
        select: { id: true, key: true, title: true, projectId: true, assignee: { select: { id: true } } },
    });
}

async function notifyAssignees(tasks, provider, eventId, title, message) {
    const assigneeIds = [...new Set(tasks.filter((t) => t.assignee?.id).map((t) => t.assignee.id))];
    if (assigneeIds.length === 0) return;
    await notifyConnectorUsers({ userIds: assigneeIds, provider, eventId, title, message });
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub — signature-verified webhooks. Org is resolved through the repo
// ConnectorMapping; the signature is checked against THAT org's webhook secret.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/webhooks/github", async (req, res) => {
    const payload = parseRaw(req);
    if (!payload) return res.status(400).json(errorResponse("BAD_PAYLOAD", "Invalid JSON payload"));

    const repoFullName = payload?.repository?.full_name;
    const eventName = String(req.headers["x-github-event"] || "");
    const deliveryId = String(req.headers["x-github-delivery"] || "");
    const action = payload?.action;

    const mapping = await prisma.connectorMapping.findFirst({
        where: { provider: "github", externalResourceType: "repo", externalResourceId: repoFullName },
    });
    if (!mapping) {
        // Nothing mapped to this repo — acknowledge and drop.
        return res.status(200).json(successResponse({ handled: false, reason: "unmapped_repository" }));
    }

    const connection = await prisma.integrationConnection.findFirst({
        where: { organizationId: mapping.organizationId, provider: "github" },
        select: { config: true },
    });
    const webhookSecret = connection?.config?.webhookSecret;
    if (!webhookSecret) {
        return res.status(401).json(errorResponse("NOT_CONFIGURED", "GitHub webhook secret is not configured"));
    }
    if (!verifySignature256(webhookSecret, rawText(req), req.headers["x-hub-signature-256"])) {
        return res.status(401).json(errorResponse("INVALID_SIGNATURE", "Invalid GitHub signature"));
    }

    const externalResourceId = repoFullName || payload?.repository?.url || "unknown";
    const keyText = [
        payload?.pull_request?.title,
        payload?.pull_request?.body,
        payload?.pull_request?.head?.ref,
        payload?.issue?.title,
        payload?.issue?.body,
        ...(payload?.commits || []).map((c) => `${c?.message || ""} ${c?.id || ""}`),
        payload?.head_commit?.message,
        payload?.comment?.body,
        payload?.review?.body,
    ].filter(Boolean).join("\n");

    let trigger = "";
    if (eventName === "pull_request" && action) {
        trigger = action === "closed" && payload?.pull_request?.merged
            ? "github.pr.merged"
            : action === "closed"
                ? "github.pr.closed"
                : `github.pr.${String(action)}`;
    } else if (eventName === "issues" && action) {
        trigger = `github.issue.${String(action)}`;
    } else if (eventName === "check_run") {
        trigger = "github.check";
    } else {
        trigger = `github.${eventName}`;
    }

    const occurredAt = new Date(payload?.head_commit?.timestamp || Date.now());
    const ingested = await ingestConnectorEvent({
        provider: "github",
        externalEventId: deliveryId || `${eventName}:${repoFullName}:${payload?.pull_request?.id || payload?.issue?.id || payload?.head_commit?.id || Date.now()}`,
        eventType: payload?.action ? `${eventName}.${payload.action}` : eventName,
        externalResourceType: "repo",
        externalResourceId,
        externalUserId: payload?.sender?.login || null,
        payload,
        occurredAt,
    });

    if (!ingested.handled || ingested.duplicate || !ingested.event) {
        return res.status(200).json(successResponse({ handled: ingested.handled, duplicate: ingested.duplicate }));
    }

    try {
        const keys = extractTaskKeys(keyText);
        const tasks = await linkedTasksFor(mapping, keys);

        // Merge strategy applied to referenced tasks.
        if (tasks.length > 0) {
            if (trigger === "github.pr.merged") {
                await prisma.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { status: "DONE", completedAt: new Date() } });
            } else if (trigger === "github.pr.opened" || trigger === "github.pr.review_requested") {
                await prisma.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { status: "IN_REVIEW" } });
            } else if (trigger === "github.check" && ["failure", "cancelled"].includes(payload?.check_run?.conclusion)) {
                await prisma.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { status: "BLOCKED", completedAt: null } });
            }
        }

        const { notifyIds } = await applyAutomations({
            provider: "github",
            trigger,
            event: ingested.event,
            mapping,
            text: keyText,
        });
        await notifyAssignees(
            tasks,
            "github",
            ingested.event.id,
            "GitHub linked your tasks",
            `${payload?.repository?.full_name}: ${trigger}.`,
        );
        await notifyConnectorUsers({
            userIds: notifyIds,
            provider: "github",
            eventId: ingested.event.id,
            title: "GitHub automated",
            message: `Automations ran for ${trigger} on ${payload?.repository?.full_name}.`,
        });

        await markEventProcessed(ingested.event.id);
        return res.status(200).json(successResponse({ handled: true, trigger }));
    } catch (error) {
        await markEventProcessed(ingested.event.id, error.message);
        console.error("[webhook] github processing failed:", error);
        return res.status(200).json(successResponse({ handled: true, error: "processing_failed" }));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Slack — signed-request verification (v0) with replay-window check. The org is
// identified by matching the signing secret against Slack connections; the
// channel resolves the workspace mapping.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/webhooks/slack", async (req, res) => {
    const bodyText = rawText(req);
    const payload = parseRaw(req);
    if (!payload) return res.status(400).json(errorResponse("BAD_PAYLOAD", "Invalid JSON payload"));

    // Slack URL verification handshake (no signature needed).
    if (payload.type === "url_verification") {
        return res.status(200).json({ challenge: payload.challenge });
    }

    const timestamp = req.headers["x-slack-request-timestamp"];
    const signature = req.headers["x-slack-signature"];

    // Identify the org via its signing secret, then verify with replay window.
    const slackConnections = await prisma.integrationConnection.findMany({
        where: { provider: "slack", enabled: true },
        select: { organizationId: true, config: true },
    });
    const match = slackConnections.find((conn) =>
        verifySlackSignature(conn.config?.webhookSigningSecret, bodyText, timestamp, signature),
    );
    if (!match) return res.status(401).json(errorResponse("INVALID_SIGNATURE", "Invalid Slack signature"));

    const event = payload?.event || {};
    if (payload.type !== "event_callback" || !event?.channel || !event?.text) {
        return ack(res);
    }

    const mapping = await prisma.connectorMapping.findFirst({
        where: {
            provider: "slack",
            externalResourceType: "channel",
            externalResourceId: String(event.channel),
            organizationId: match.organizationId,
        },
    });
    if (!mapping) return ack(res);

    const ingested = await ingestConnectorEvent({
        provider: "slack",
        externalEventId: String(event?.event_id || `${event.channel}:${event.ts}`),
        eventType: `slack.${event.subtype || "message"}`,
        externalResourceType: "channel",
        externalResourceId: String(event.channel),
        externalUserId: event?.user || null,
        payload: event,
        occurredAt: new Date(Number(event.ts) * 1000 || Date.now()),
    });

    if (!ingested.handled || ingested.duplicate || !ingested.event) {
        return ack(res);
    }

    try {
        const keys = extractTaskKeys(event.text);
        const tasks = await linkedTasksFor(mapping, keys);
        const { notifyIds } = await applyAutomations({
            provider: "slack",
            trigger: "slack.message",
            event: ingested.event,
            mapping,
            text: event.text,
        });
        await notifyAssignees(tasks, "slack", ingested.event.id, "Slack mentioned your tasks", event.text.slice(0, 120));
        await notifyConnectorUsers({ userIds: notifyIds, provider: "slack", eventId: ingested.event.id, title: "Slack automation", message: "A Slack message triggered an automation." });

        await markEventProcessed(ingested.event.id);
        return ack(res);
    } catch (error) {
        await markEventProcessed(ingested.event.id, error.message);
        console.error("[webhook] slack processing failed:", error);
        return ack(res);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Figma — passcode-verified webhooks. The passcode identifies the org because
// it is unique per Figma integration connection.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/webhooks/figma", async (req, res) => {
    const payload = parseRaw(req);
    if (!payload) return res.status(400).json(errorResponse("BAD_PAYLOAD", "Invalid JSON payload"));

    const providedPasscode = req.query?.passcode || req.query?.PASSCODE;
    const figmaConnections = await prisma.integrationConnection.findMany({
        where: { provider: "figma", enabled: true },
        select: { organizationId: true, config: true },
    });
    const match = figmaConnections.find((conn) => verifyFigmaPasscode(conn.config?.webhookPasscode, providedPasscode));
    if (!match) return res.status(401).json(errorResponse("INVALID_PASSCODE", "Invalid Figma webhook passcode"));

    const fileKey = payload?.file_key || payload?.file_key_id;
    if (!fileKey) return ack(res);

    const mapping = await prisma.connectorMapping.findFirst({
        where: {
            provider: "figma",
            externalResourceType: "file",
            externalResourceId: String(fileKey),
            organizationId: match.organizationId,
        },
    });
    if (!mapping) return ack(res);

    const eventType = String(payload?.event_type || "unknown");
    const comment = payload?.comment?.message || "";
    const keyText = `${payload?.file_name || ""} ${comment}`;

    const ingested = await ingestConnectorEvent({
        provider: "figma",
        externalEventId: `${eventType}:${fileKey}:${payload?.comment?.id || payload?.timestamp || Date.now()}`,
        eventType,
        externalResourceType: "file",
        externalResourceId: String(fileKey),
        externalUserId: payload?.comment?.user_id || null,
        payload,
        occurredAt: new Date(payload?.timestamp || Date.now()),
    });

    if (!ingested.handled || ingested.duplicate || !ingested.event) {
        return ack(res);
    }

    try {
        const keys = extractTaskKeys(keyText);
        const tasks = await linkedTasksFor(mapping, keys);
        const { notifyIds } = await applyAutomations({
            provider: "figma",
            trigger: `figma.${eventType.toLowerCase()}`,
            event: ingested.event,
            mapping,
            text: keyText,
        });
        await notifyAssignees(tasks, "figma", ingested.event.id, "Figma update mentioned your tasks", comment.slice(0, 120) || payload?.file_name);
        await notifyConnectorUsers({ userIds: notifyIds, provider: "figma", eventId: ingested.event.id, title: "Figma automation", message: `Figma triggered an automation for ${payload?.file_name || fileKey}.` });

        await markEventProcessed(ingested.event.id);
        return ack(res);
    } catch (error) {
        await markEventProcessed(ingested.event.id, error.message);
        console.error("[webhook] figma processing failed:", error);
        return ack(res);
    }
});

export { router as integrationsWebhooksRouter };