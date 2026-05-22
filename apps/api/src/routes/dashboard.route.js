import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const [myTasks, recentActivity, projects, upcomingDeadlines] = await Promise.all([
            prisma.issue.findMany({
                where: { assigneeId: req.user.id, project: { workspaceId }, status: { not: "DONE" } },
                include: { project: { select: { name: true, color: true } } },
                orderBy: { dueDate: "asc" },
                take: 10,
            }),
            prisma.activityLog.findMany({
                where: { project: { workspaceId } },
                include: { user: { select: { id: true, name: true, avatarUrl: true } }, project: { select: { name: true } }, issue: { select: { title: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
            prisma.project.findMany({
                where: { workspaceId },
                include: { issues: { select: { status: true } } },
                orderBy: { updatedAt: "desc" },
                take: 6,
            }),
            prisma.issue.findMany({
                where: { project: { workspaceId }, dueDate: { gte: new Date() }, status: { not: "DONE" } },
                include: { project: { select: { name: true, color: true } }, assignee: { select: { name: true, avatarUrl: true } } },
                orderBy: { dueDate: "asc" },
                take: 5,
            }),
        ]);

        const projectProgress = projects.map((p) => {
            const total = p.issues.length;
            const done = p.issues.filter((i) => i.status === "DONE").length;
            return { id: p.id, name: p.name, color: p.color, completedIssues: done, totalIssues: total, progress: total ? Math.round((done / total) * 100) : 0 };
        });

        return res.status(200).json(successResponse({
            myTasks: myTasks.map((t) => ({ id: t.id, title: t.title, project: t.project.name, projectColor: t.project.color, status: t.status, priority: t.priority, dueDate: t.dueDate })),
            recentActivity: recentActivity.map((a) => ({ id: a.id, actor: a.user.name, actorAvatar: a.user.avatarUrl, action: a.action, target: a.issue?.title || a.project?.name || "", createdAt: a.createdAt })),
            projectProgress,
            upcomingDeadlines: upcomingDeadlines.map((i) => ({ id: i.id, title: i.title, project: i.project.name, projectColor: i.project.color, dueDate: i.dueDate, assignee: i.assignee })),
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch dashboard data"));
    }
});

export { router as dashboardRouter };
