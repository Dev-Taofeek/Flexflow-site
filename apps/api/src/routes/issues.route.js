import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

// GET /api/issues?workspaceId=...&status=...&assigneeId=...&page=1
router.get("/", async (req, res) => {
    try {
        const { workspaceId, status, priority, assigneeId, page = 1 } = req.query;
        if (!workspaceId) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));
        }

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const where = {
            project: { workspaceId },
            ...(status && { status }),
            ...(priority && { priority }),
            ...(assigneeId === "me" ? { assigneeId: req.user.id } : assigneeId ? { assigneeId } : {}),
        };

        const take = 50;
        const skip = (Number(page) - 1) * take;

        const [issues, total] = await Promise.all([
            prisma.issue.findMany({
                where,
                include: {
                    project: { select: { id: true, name: true, color: true } },
                    assignee: { select: { id: true, name: true, avatarUrl: true } },
                    createdBy: { select: { id: true, name: true } },
                    labels: { include: { label: true } },
                    _count: { select: { comments: true } },
                },
                orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
                take,
                skip,
            }),
            prisma.issue.count({ where }),
        ]);

        return res.status(200).json(successResponse({ issues, total, page: Number(page), pageSize: take }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch issues"));
    }
});

// POST /api/issues — create issue (project must be in the workspace)
router.post("/", async (req, res) => {
    try {
        const { projectId, title, description, priority = "MEDIUM", status = "TODO", assigneeId, dueDate } = req.body;
        if (!projectId || !title?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "projectId and title are required"));
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const issue = await prisma.issue.create({
            data: {
                projectId,
                createdById: req.user.id,
                title: title.trim(),
                description: description || null,
                priority,
                status,
                assigneeId: assigneeId || null,
                dueDate: dueDate ? new Date(dueDate) : null,
            },
            include: {
                project: { select: { id: true, name: true, color: true } },
                assignee: { select: { id: true, name: true, avatarUrl: true } },
                createdBy: { select: { id: true, name: true } },
                _count: { select: { comments: true } },
            },
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                projectId,
                issueId: issue.id,
                action: "created",
                entityType: "issue",
                entityId: issue.id,
            },
        });

        return res.status(201).json(successResponse(issue));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create issue"));
    }
});

export { router as issuesRouter };
