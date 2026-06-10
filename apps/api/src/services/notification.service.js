import { prisma } from "../lib/prisma.js";

export async function notifyUser(userId, { title, message, type = "INFO" }) {
    if (!userId || !title || !message) return null;

    return prisma.notification.create({
        data: { userId, title, message, type },
    }).catch((error) => {
        console.error("Notification create failed:", error);
        return null;
    });
}
