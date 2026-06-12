import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/rbac.middleware.js";
import { notifyTaskUsers } from "../services/task-notification.service.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

const TASK_INCLUDE = {
    project: { select: { id: true, name: true, color: true } },
    assignee: { select: { id: true, name: true, avatarUrl: true } },
    assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    createdBy: { select: { id: true, name: true } },
    labels: { include: { label: true } },
    _count: { select: { comments: true } },
};

// GET /api/tasks?workspaceId=...&status=...&priority=...&assigneeId=...&page=1
router.get("/", async (req, res) => {
    try {
        const { workspaceId, status, priority, assigneeId, page = 1 } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const take = 50;
        const skip = (Number(page) - 1) * take;

        const where = {
            project: { workspaceId },
            ...(status && { status }),
            ...(priority && { priority }),
            ...(assigneeId === "me"
                ? {
                    OR: [
                        { assigneeId: req.user.id },
                        { assignees: { some: { userId: req.user.id } } },
                    ],
                }
                : assigneeId
                ? {
                    OR: [
                        { assigneeId },
                        { assignees: { some: { userId: assigneeId } } },
                    ],
                }
                : {}),
        };

        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                include: TASK_INCLUDE,
                orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
                take,
                skip,
            }),
            prisma.task.count({ where }),
        ]);

        return res.status(200).json(successResponse({ tasks, total, page: Number(page), pageSize: take }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch tasks"));
    }
});

// POST /api/tasks
router.post("/", authorize("tasks", "create"), async (req, res) => {
    try {
        const { projectId, title, description, priority = "MEDIUM", status = "TODO", assigneeIds = [], dueDate } = req.body;
        if (!projectId || !title?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "projectId and title are required"));
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const ids = Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [assigneeIds].filter(Boolean);
        const primaryAssigneeId = ids[0] || null;

        const task = await prisma.task.create({
            data: {
                projectId,
                createdById: req.user.id,
                title: title.trim(),
                description: description || null,
                priority,
                status,
                assigneeId: primaryAssigneeId,
                dueDate: dueDate ? new Date(dueDate) : null,
                assignees: ids.length > 0 ? {
                    create: ids.map((userId) => ({ userId })),
                } : undefined,
            },
            include: TASK_INCLUDE,
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                projectId,
                taskId: task.id,
                action: "created",
                entityType: "task",
                entityId: task.id,
            },
        });

        await notifyUser(req.user.id, {
            title: "Task created",
            message: `${task.title} was created.`,
            type: "SYSTEM",
        });

        const assignedOnCreate = ids.filter((id) => id !== req.user.id);
        if (assignedOnCreate.length > 0) {
            await notifyTaskUsers(assignedOnCreate, task, {
                actorId: req.user.id,
                title: "You've been assigned to a task",
                message: `${req.user.name} assigned you to: ${task.title}`,
                type: "TASK_ASSIGNED",
                subject: `You've been assigned: ${task.title}`,
                actionText: "Open task",
            });
        }

        return res.status(201).json(successResponse(task));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create task"));
    }
});

// PATCH /api/tasks/:taskId/assignees — update assignees list
router.patch("/:taskId/assignees", authorize("tasks", "update"), async (req, res) => {
    try {
        const { taskId } = req.params;
        const { assigneeIds = [] } = req.body;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: { select: { workspaceId: true } },
                assignees: { select: { userId: true } },
            },
        });
        if (!task) return res.status(404).json(errorResponse("NOT_FOUND", "Task not found"));

        const ids = [...new Set(assigneeIds.filter(Boolean))];
        const primaryId = ids[0] || null;

        // Replace all assignees atomically
        await prisma.$transaction([
            prisma.taskAssignee.deleteMany({ where: { taskId } }),
            ...(ids.length > 0
                ? [prisma.taskAssignee.createMany({ data: ids.map((userId) => ({ taskId, userId })) })]
                : []),
            prisma.task.update({ where: { id: taskId }, data: { assigneeId: primaryId } }),
        ]);

        // Notify newly added assignees
        const oldIds = new Set((task.assignees || []).map((a) => a.userId));
        const newlyAdded = ids.filter((id) => !oldIds.has(id));

        if (newlyAdded.length > 0) {
            await notifyTaskUsers(newlyAdded, task, {
                actorId: req.user.id,
                title: "You've been assigned to a task",
                message: `${req.user.name} assigned you to: ${task.title}`,
                type: "TASK_ASSIGNED",
                subject: `You've been assigned: ${task.title}`,
                actionText: "Open task",
            });
        }

        const updated = await prisma.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update assignees"));
    }
});

export { router as tasksRouter };
