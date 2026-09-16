import webpush from "web-push";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

let configured = false;

export function isPushConfigured() {
    if (configured) return true;
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return false;

    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
    return true;
}

export async function sendPushToUser(userId, { title, body, url, tag }) {
    if (!isPushConfigured() || !userId) return;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url, tag });

    await Promise.all(subscriptions.map(async (sub) => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
            );
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            } else {
                console.error("Push notification failed:", error.message);
            }
        }
    }));
}
