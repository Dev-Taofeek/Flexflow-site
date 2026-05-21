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

export { router as notificationsRouter };
