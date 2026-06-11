import { prisma } from "../lib/prisma.js";
import { getIO } from "../lib/realtime.js";
import { sendPushToUser } from "./push.service.js";

export async function notifyUser(userId, { title, message, type = "INFO", url } = {}) {
    if (!userId || !title || !message) return null;

    const notification = await prisma.notification.create({
        data: { userId, title, message, type },
    }).catch((error) => {
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
