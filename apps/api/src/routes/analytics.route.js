import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { enforceFeature } from "../lib/entitlements.js";
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

        // Velocity/workload/cycle-time analytics are a PRO entitlement.
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { organizationId: true },
        });
        const entitlements = await enforceFeature(req, res, workspace.organizationId, "advanced_analytics");
        if (!entitlements) return;

        const now = new Date();
        const sixWeeksAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

        const [allTasks, workspaceMembers] = await Promise.all([
            prisma.task.findMany({
                where: { project: { workspaceId }, createdAt: { gte: sixWeeksAgo } },
                select: { status: true, priority: true, createdAt: true, updatedAt: true, completedAt: true, assigneeId: true },
            }),
            prisma.workspaceMember.findMany({
                where: { workspaceId },
                include: {
                    user: {
                        select: {
                            id: true, name: true,
                            assignedTasks: { where: { project: { workspaceId }, status: { not: "DONE" } }, select: { status: true } },
                        },
                    },
                },
                take: 10,
            }),
        ]);

        // Velocity: group by week
        const velocity = Array.from({ length: 6 }, (_, i) => {
            const weekStart = new Date(now.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            const label = `Week ${i + 1}`;
            const created = allTasks.filter((task) => task.createdAt >= weekStart && task.createdAt < weekEnd).length;
            const closed = allTasks.filter((task) => task.status === "DONE" && task.updatedAt >= weekStart && task.updatedAt < weekEnd).length;
            return { week: label, created, closed };
        });

        // Workload
        const workload = workspaceMembers.map((m) => {
            const tasks = m.user.assignedTasks;
            return {
                member: m.user.name.split(" ")[0],
                todo: tasks.filter((i) => i.status === "TODO").length,
                inProgress: tasks.filter((i) => i.status === "IN_PROGRESS").length,
                review: tasks.filter((i) => i.status === "IN_REVIEW").length,
            };
        }).filter((m) => m.todo + m.inProgress + m.review > 0);

        // Cycle time: diff between createdAt and updatedAt for DONE tasks
        const doneTasks = allTasks.filter((i) => i.status === "DONE");
        const cycleTimes = doneTasks.map((i) => (new Date(i.updatedAt) - new Date(i.createdAt)) / (1000 * 60 * 60 * 24));
        const cycleTime = [
            { range: "0-1d", tasks: cycleTimes.filter((d) => d < 1).length },
            { range: "1-2d", tasks: cycleTimes.filter((d) => d >= 1 && d < 2).length },
            { range: "2-4d", tasks: cycleTimes.filter((d) => d >= 2 && d < 4).length },
            { range: "4-7d", tasks: cycleTimes.filter((d) => d >= 4 && d < 7).length },
            { range: "7d+", tasks: cycleTimes.filter((d) => d >= 7).length },
        ];

        const avgCycleTime = cycleTimes.length ? (cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1) : "0";

        // Burndown over the last 14 days: the sprint scope is every task created
        // on or before the window start; remaining counts tasks not yet completed.
        const DAY_MS = 24 * 60 * 60 * 1000;
        const BURNDOWN_DAYS = 14;
        const start = new Date(now.getTime() - (BURNDOWN_DAYS - 1) * DAY_MS);
        start.setHours(0, 0, 0, 0);
        const doneAt = (task) => (task.completedAt || task.updatedAt || task.createdAt).getTime();
        const sprintTasks = allTasks.filter((task) => new Date(task.createdAt) <= start);
        const burndown = Array.from({ length: BURNDOWN_DAYS }, (_, i) => {
            const day = new Date(start.getTime() + i * DAY_MS);
            const dayEnd = day.getTime() + DAY_MS;
            const remaining = sprintTasks.filter(
                (task) => !(task.status === "DONE" && doneAt(task) <= dayEnd),
            ).length;
            const ideal = sprintTasks.length
                ? Math.round(sprintTasks.length * (1 - i / (BURNDOWN_DAYS - 1)))
                : 0;
            return { day: day.toISOString().slice(5, 10), ideal, remaining: Math.max(0, remaining) };
        });

        const sprintCompletion = allTasks.length
            ? `${Math.round((doneTasks.length / allTasks.length) * 100)}%`
            : "0%";

        return res.status(200).json(successResponse({
            velocity,
            workload,
            cycleTime,
            burndown,
            summary: {
                tasksClosed: doneTasks.length,
                averageCycleTime: `${avgCycleTime}d`,
                teamUtilization: workspaceMembers.length ? `${Math.round((workload.reduce((a, b) => a + b.inProgress, 0) / Math.max(workspaceMembers.length, 1)) * 10)}%` : "0%",
                totalTasks: allTasks.length,
                sprintCompletion,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch analytics"));
    }
});

export { router as analyticsRouter };
