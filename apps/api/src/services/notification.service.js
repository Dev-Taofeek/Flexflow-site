import { prisma } from "../lib/prisma.js";
import { getIO } from "../lib/realtime.js";
import { sendPushToUser } from "./push.service.js";

export async function notifyUser(userId, { title, message, type = "INFO", url, dedupeKey } = {}) {
    if (!userId || !title || !message) return null;

    // Idempotent notifications: never emit the same lifecycle event twice.
    if (dedupeKey) {
        const existing = await prisma.notification
            .findUnique({ where: { userId_dedupeKey: { userId, dedupeKey } } })
            .catch(() => null);
        if (existing) return existing;
    }

    const notification = await prisma.notification.create({
        data: { userId, title, message, type, ...(dedupeKey ? { dedupeKey } : {}) },
    }).catch((error) => {
        if (error?.code === "P2002") return null; // concurrent duplicate — fine
        console.error("Notification create failed:", error);
        return null;
    });

    if (!notification) return null;

    getIO()?.to(userId).emit("notification:new", notification);

    sendPushToUser(userId, { title, body: message, url, tag: type }).catch((error) => {
        console.error("Push notification failed:", error.message);
    });

    return notification;
}