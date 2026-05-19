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

        const now = new Date();
        const sixWeeksAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

        const [allIssues, workspaceMembers] = await Promise.all([
            prisma.issue.findMany({
                where: { project: { workspaceId }, createdAt: { gte: sixWeeksAgo } },
                select: { status: true, priority: true, createdAt: true, updatedAt: true, assigneeId: true },
            }),
            prisma.workspaceMember.findMany({
                where: { workspaceId },
                include: {
                    user: {
                        select: {
                            id: true, name: true,
                            assignedIssues: { where: { project: { workspaceId }, status: { not: "DONE" } }, select: { status: true } },
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
            const created = allIssues.filter((issue) => issue.createdAt >= weekStart && issue.createdAt < weekEnd).length;
            const closed = allIssues.filter((issue) => issue.status === "DONE" && issue.updatedAt >= weekStart && issue.updatedAt < weekEnd).length;
            return { week: label, created, closed };
        });

        // Workload
        const workload = workspaceMembers.map((m) => {
            const issues = m.user.assignedIssues;
            return {
                member: m.user.name.split(" ")[0],
                todo: issues.filter((i) => i.status === "TODO").length,
                inProgress: issues.filter((i) => i.status === "IN_PROGRESS").length,
                review: issues.filter((i) => i.status === "IN_REVIEW").length,
            };
        }).filter((m) => m.todo + m.inProgress + m.review > 0);

        // Cycle time: diff between createdAt and updatedAt for DONE issues
        const doneIssues = allIssues.filter((i) => i.status === "DONE");
        const cycleTimes = doneIssues.map((i) => (new Date(i.updatedAt) - new Date(i.createdAt)) / (1000 * 60 * 60 * 24));
        const cycleTime = [
            { range: "0-1d", issues: cycleTimes.filter((d) => d < 1).length },
            { range: "1-2d", issues: cycleTimes.filter((d) => d >= 1 && d < 2).length },
            { range: "2-4d", issues: cycleTimes.filter((d) => d >= 2 && d < 4).length },
            { range: "4-7d", issues: cycleTimes.filter((d) => d >= 4 && d < 7).length },
            { range: "7d+", issues: cycleTimes.filter((d) => d >= 7).length },
        ];

        const avgCycleTime = cycleTimes.length ? (cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1) : "0";

        return res.status(200).json(successResponse({
            velocity,
            workload,
            cycleTime,
            summary: {
                issuesClosed: doneIssues.length,
                averageCycleTime: `${avgCycleTime}d`,
                teamUtilization: workspaceMembers.length ? `${Math.round((workload.reduce((a, b) => a + b.inProgress, 0) / Math.max(workspaceMembers.length, 1)) * 10)}%` : "0%",
                totalIssues: allIssues.length,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch analytics"));
    }
});

export { router as analyticsRouter };
