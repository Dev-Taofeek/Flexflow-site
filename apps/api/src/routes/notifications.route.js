import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
    try {
        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
        ]);
        return res.status(200).json(successResponse({ notifications, unreadCount }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch notifications"));
    }
});

router.patch("/read-all", async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        return res.status(200).json(successResponse({ updated: true }));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to mark all as read"));
    }
});

router.patch("/:id/read", async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { id: req.params.id, userId: req.user.id },
            data: { isRead: true },
        });
        return res.status(200).json(successResponse({ updated: true }));
    } catch (error) {
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to mark notification as read"));
    }
});

router.post("/push-subscriptions", async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "endpoint and keys are required"));
        }

        await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers["user-agent"] || null },
            create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers["user-agent"] || null },
        });

        return res.status(201).json(successResponse({ subscribed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to save push subscription"));
    }
});

router.delete("/push-subscriptions", async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(422).json(errorResponse("VALIDATION_ERROR", "endpoint is required"));

        await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
        return res.status(200).json(successResponse({ unsubscribed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove push subscription"));
    }
});

export { router as notificationsRouter };
