import crypto from "crypto";

import { prisma } from "../lib/prisma.js";
import { decryptSecret } from "../lib/crypto.js";

export const OUTBOUND_EVENTS = ["task.created", "comment.created", "project.created"];

export async function deliverOutboundWebhooks({ organizationId, eventType, payload }) {
    try {
        const webhooks = await prisma.outboundWebhook.findMany({
            where: { organizationId, enabled: true, events: { has: eventType } },
            select: { id: true, name: true, url: true, secret: true },
        });
        if (webhooks.length === 0) return;

        const body = JSON.stringify({
            version: "1.0",
            event_type: eventType,
            sent_at: new Date().toISOString(),
            payload,
        });

        const results = await Promise.all(
            webhooks.map(async (hook) => {
                try {
                    const secret = hook.secret ? decryptSecret(hook.secret) : null;
                    const headers = { "Content-Type": "application/json", "User-Agent": "flexflow-webhooks/1.0" };
                    if (secret) {
                        headers["X-FlexFlow-Signature"] = `sha256=${crypto
                            .createHmac("sha256", secret)
                            .update(body)
                            .digest("hex")}`;
                    }
                    const res = await fetch(hook.url, { method: "POST", headers, body });
                    const status = res.ok ? "SUCCESS" : `HTTP_${res.status}`;
                    await prisma.outboundWebhook.update({
                        where: { id: hook.id },
                        data: { lastDeliveryAt: new Date(), lastStatus: status },
                    }).catch(() => {});
                    return { id: hook.id, status };
                } catch (error) {
                    await prisma.outboundWebhook.update({
                        where: { id: hook.id },
                        data: { lastDeliveryAt: new Date(), lastStatus: "FAILED" },
                    }).catch(() => {});
                    console.error(`outbound webhook "${hook.name}" failed:`, error.message);
                    return { id: hook.id, status: "FAILED" };
                }
            }),
        );

        return results;
    } catch (error) {
        console.error("outbound webhook delivery error:", error.message);
    }
}