import { Router } from "express";
import { prisma } from "../lib/prisma.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { trackApiUsage } from "../middleware/usage.middleware.js";
import { authorize } from "../middleware/rbac.middleware.js";
import { checkPermission } from "../lib/permissions.js";
import { enforceMinLimit } from "../lib/entitlements.js";
import { nextTaskKey } from "../lib/task-key.js";
import { notifyTaskParticipants, notifyTaskUsers } from "../services/task-notification.service.js";
import { notifyUser } from "../services/notification.service.js";
import { deliverOutboundWebhooks } from "../services/outbound.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);
router.use(trackApiUsage);

const USER_SELECT = { id: true, name: true, email: true, avatarUrl: true };

async function assertWorkspaceAccess(workspaceId, userId) {
    const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member;
}

// Work states an assignee may move a task through; DONE is reserved for
// the assigner (task creator) and users with the tasks:update permission.
const WORK_STATES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"];

function emitToProject(io, projectId, event, payload) {
    io?.to(`project:${projectId}`).emit(event, payload);
}

// Resolves who may set a task's status:
// - "admin"    → has tasks:update permission (OWNER/ADMIN or a custom role granting it)
// - "creator"  → the task creator (the assigner who reviews)
// - "assignee" → an assigned user, limited to the work states
// - "none"     → no access
async function resolveTaskStatusAccess(userId, task) {
    const member = await assertWorkspaceAccess(task.project.workspaceId, userId);
    if (!member) return "none";

    const { allowed } = await checkPermission(task.project.workspaceId, userId, "tasks", "update");
    if (allowed) return "admin";

    if (userId === task.createdById) return "creator";

    const isAssignee =
        userId === task.assigneeId ||
        (task.assignees || []).some((a) => a.userId === userId);
    return isAssignee ? "assignee" : "none";
}

router.get("/", async (req, res) => {
    try {
        const { workspaceId, search, visibility, sort = "recent" } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const member = await assertWorkspaceAccess(workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const projects = await prisma.project.findMany({
            where: {
                workspaceId,
                ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }),
                ...(visibility && visibility !== "all" && { visibility: visibility.toUpperCase() }),
            },
            include: {
                _count: { select: { tasks: true } },
                createdBy: { select: USER_SELECT },
                tasks: { select: { status: true } },
            },
            orderBy: sort === "name" ? { name: "asc" } : { updatedAt: "desc" },
        });

        const result = projects.map((p) => {
            const total = p.tasks.length;
            const done = p.tasks.filter((i) => i.status === "DONE").length;
            return { ...p, totalTasks: total, completedTasks: done, progress: total ? Math.round((done / total) * 100) : 0, tasks: undefined };
        });

        if (sort === "progress") result.sort((a, b) => b.progress - a.progress);

        return res.status(200).json(successResponse(result));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch projects"));
    }
});

router.post("/", authorize("projects", "create"), async (req, res) => {
    try {
        const { workspaceId, name, description, color, visibility } = req.body;
        if (!workspaceId || !name?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId and name are required"));
        }

        // ── Plan-based project-limit enforcement (project counts across the org) ──
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { organizationId: true },
        });
        if (!workspace) return res.status(404).json(errorResponse("NOT_FOUND", "Workspace not found"));

        const projectCount = await prisma.project.count({
            where: { workspace: { organizationId: workspace.organizationId } },
        });
        const entitlements = await enforceMinLimit(req, res, workspace.organizationId, "projects", projectCount + 1);
        if (!entitlements) return;

        const project = await prisma.project.create({
            data: {
                workspaceId,
                createdById: req.user.id,
                name: name.trim(),
                description: description?.trim() || null,
                color: color || "#6366f1",
                visibility: visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
            },
            include: { createdBy: { select: USER_SELECT } },
        });

        await notifyUser(req.user.id, {
            title: "Project created",
            message: `${project.name} was created.`,
            type: "SYSTEM",
        });

        deliverOutboundWebhooks({
            organizationId: workspace.organizationId,
            eventType: "project.created",
            payload: {
                project: { id: project.id, name: project.name, workspaceId: workspace.id },
                actor: { id: req.user.id, name: req.user.name },
            },
        }).catch(() => {});

        return res.status(201).json(successResponse({ ...project, totalTasks: 0, completedTasks: 0, progress: 0 }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create project"));
    }
});

router.get("/:projectId", async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.projectId },
            include: { createdBy: { select: USER_SELECT } },
        });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await assertWorkspaceAccess(project.workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            include: {
                assignee: { select: USER_SELECT },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
                _count: { select: { comments: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json(successResponse({ project, tasks }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch project"));
    }
});

// GET /api/projects/:projectId/activity?limit=5&skip=0
router.get("/:projectId/activity", async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await assertWorkspaceAccess(project.workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const limit = Math.min(Number(req.query.limit) || 5, 100);
        const skip = Number(req.query.skip) || 0;

        const [activities, total] = await Promise.all([
            prisma.activityLog.findMany({
                where: { projectId: req.params.projectId },
                include: {
                    user: { select: USER_SELECT },
                    task: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip,
            }),
            prisma.activityLog.count({ where: { projectId: req.params.projectId } }),
        ]);

        return res.status(200).json(successResponse({ activities, total }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch project activity"));
    }
});

router.patch("/:projectId", authorize("projects", "update"), async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const { name, description, color, visibility } = req.body;
        const updated = await prisma.project.update({
            where: { id: req.params.projectId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(color && { color }),
                ...(visibility && { visibility }),
            },
        });

        await notifyUser(req.user.id, {
            title: "Project updated",
            message: `${updated.name} was updated.`,
            type: "SYSTEM",
        });

        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update project"));
    }
});

router.delete("/:projectId", authorize("projects", "delete"), async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        await prisma.project.delete({ where: { id: req.params.projectId } });
        await notifyUser(req.user.id, {
            title: "Project deleted",
            message: `${project.name} was deleted.`,
            type: "SYSTEM",
        });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete project"));
    }
});

router.get("/:projectId/tasks/:taskId", async (req, res) => {
    try {
        const task = await prisma.task.findFirst({
            where: { id: req.params.taskId, projectId: req.params.projectId },
            include: {
                assignee: { select: USER_SELECT },
                assignees: { include: { user: { select: USER_SELECT } } },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
                comments: {
                    include: { author: { select: USER_SELECT } },
                    orderBy: { createdAt: "asc" },
                },
                activities: {
                    include: { user: { select: USER_SELECT } },
                    orderBy: { createdAt: "desc" },
                },
                project: { include: { workspace: true } },
            },
        });

        if (!task) return res.status(404).json(errorResponse("NOT_FOUND", "Task not found"));

        const member = await assertWorkspaceAccess(task.project.workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const labels = await prisma.label.findMany({ where: { workspaceId: task.project.workspaceId } });

        // Fetch workspace members for the assignee picker — never dumps the
        // whole organization's roster into a workspace the caller belongs to.
        const workspaceMembers = await prisma.workspaceMember.findMany({
            where: { workspaceId: task.project.workspaceId },
            include: { user: { select: USER_SELECT } },
        });

        return res.status(200).json(successResponse({
            task,
            project: task.project,
            comments: task.comments,
            activityLog: task.activities,
            people: workspaceMembers.map((m) => m.user),
            availableLabels: labels,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch task"));
    }
});

router.post("/:projectId/tasks", authorize("tasks", "create"), async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const { title, description, priority, status, assigneeId, dueDate } = req.body;
        if (!title?.trim()) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Title is required"));

        const key = await nextTaskKey(project.workspaceId);

        const task = await prisma.task.create({
            data: {
                projectId: project.id,
                workspaceId: project.workspaceId,
                key,
                createdById: req.user.id,
                title: title.trim(),
                description: description || null,
                priority: priority || "MEDIUM",
                status: status || "TODO",
                assigneeId: assigneeId || null,
                dueDate: dueDate ? new Date(dueDate) : null,
                completedAt: (status || "TODO") === "DONE" ? new Date() : null,
            },
            include: {
                assignee: { select: USER_SELECT },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
            },
        });

        await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: project.id, workspaceId: project.workspaceId, taskId: task.id, action: "created", entityType: "task", entityId: task.id },
        });

        await notifyUser(req.user.id, {
            title: "Task created",
            message: `${task.title} was created in ${project.name}.`,
            type: "SYSTEM",
        });

        if (assigneeId && assigneeId !== req.user.id) {
            await notifyTaskUsers([assigneeId], task, {
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

router.patch("/:projectId/tasks/:taskId/status", async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];
        if (!validStatuses.includes(status)) {
            return res.status(422).json(errorResponse("INVALID_STATUS", "Invalid status"));
        }

        const task = await prisma.task.findFirst({
            where: { id: req.params.taskId, projectId: req.params.projectId },
            include: {
                project: { select: { workspaceId: true } },
                assignees: { select: { userId: true } },
                createdBy: { select: USER_SELECT },
            },
        });
        if (!task) return res.status(404).json(errorResponse("NOT_FOUND", "Task not found"));

        const access = await resolveTaskStatusAccess(req.user.id, task);
        const allowedStatuses = access === "assignee" ? WORK_STATES : validStatuses;
        if (access === "none" || !allowedStatuses.includes(status)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You do not have permission to set this task's status"));
        }

        const previousStatus = task.status;

        const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
                status,
                completedAt: status === "DONE" ? new Date() : null,
            },
            include: {
                assignee: { select: USER_SELECT },
                assignees: { include: { user: { select: USER_SELECT } } },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
            },
        });

        const activity = await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: task.projectId, workspaceId: task.project.workspaceId, taskId: task.id, action: `changed status to ${status}`, entityType: "task", entityId: task.id },
            include: { user: { select: USER_SELECT } },
        });

        await notifyUser(req.user.id, {
            title: "Task status updated",
            message: `${updated.title} moved to ${status.replaceAll("_", " ")}.`,
            type: "SYSTEM",
        });

        if (status === "IN_REVIEW" && previousStatus !== "IN_REVIEW") {
            // Assignee submitted for review → alert the assigner (task creator)
            await notifyTaskUsers([task.createdById], updated, {
                actorId: req.user.id,
                title: "Review requested",
                message: `${req.user.name} submitted "${updated.title}" for your review.`,
                type: "TASK_ASSIGNED",
                subject: `Review requested: ${updated.title}`,
                actionText: "Review task",
            });
            await notifyTaskParticipants(task.id, {
                actorId: req.user.id,
                title: "Task submitted for review",
                message: `${req.user.name} submitted ${updated.title} for review.`,
                type: "SYSTEM",
                subject: `Task submitted: ${updated.title}`,
                actionText: "View task",
                excludeUserIds: [task.createdById],
            });
        } else if (previousStatus === "IN_REVIEW" && status === "DONE") {
            await notifyTaskParticipants(task.id, {
                actorId: req.user.id,
                title: "Task approved",
                message: `${req.user.name} approved ${updated.title}.`,
                type: "SYSTEM",
                subject: `Task approved: ${updated.title}`,
                actionText: "View task",
            });
        } else if (previousStatus === "IN_REVIEW" && status !== "DONE") {
            await notifyTaskParticipants(task.id, {
                actorId: req.user.id,
                title: "Changes requested",
                message: `${req.user.name} requested changes on ${updated.title} (moved to ${status.replaceAll("_", " ")}).`,
                type: "SYSTEM",
                subject: `Changes requested: ${updated.title}`,
                actionText: "View task",
            });
        } else {
            await notifyTaskParticipants(task.id, {
                actorId: req.user.id,
                title: "Task status updated",
                message: `${req.user.name} moved ${updated.title} to ${status.replaceAll("_", " ")}.`,
                type: "SYSTEM",
                subject: `Task updated: ${updated.title}`,
                actionText: "View update",
            });
        }

        emitToProject(req.app.get("io"), req.params.projectId, "task:status-updated", { projectId: req.params.projectId, task: updated, activity });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update status"));
    }
});

router.patch("/:projectId/tasks/:taskId", authorize("tasks", "update"), async (req, res) => {
    try {
        const task = await prisma.task.findFirst({ where: { id: req.params.taskId, projectId: req.params.projectId }, include: { project: true } });
        if (!task) return res.status(404).json(errorResponse("NOT_FOUND", "Task not found"));

        const { title, description, priority, status, assigneeId, dueDate } = req.body;
        const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
                ...(title && { title: title.trim() }),
                ...(description !== undefined && { description }),
                ...(priority && { priority }),
                ...(status && { status }),
                ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            },
            include: { assignee: { select: USER_SELECT }, labels: { include: { label: true } } },
        });

        const activity = await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: task.projectId, workspaceId: task.project.workspaceId, taskId: task.id, action: "updated task", entityType: "task", entityId: task.id },
            include: { user: { select: USER_SELECT } },
        });

        await notifyUser(req.user.id, {
            title: "Task updated",
            message: `${updated.title} was updated.`,
            type: "SYSTEM",
        });
        if (assigneeId && assigneeId !== task.assigneeId && assigneeId !== req.user.id) {
            await notifyTaskUsers([assigneeId], updated, {
                actorId: req.user.id,
                title: "You've been assigned to a task",
                message: `${req.user.name} assigned you to: ${updated.title}`,
                type: "TASK_ASSIGNED",
                subject: `You've been assigned: ${updated.title}`,
                actionText: "Open task",
            });
        }
        await notifyTaskParticipants(task.id, {
            actorId: req.user.id,
            title: "Task updated",
            message: `${req.user.name} updated ${updated.title}.`,
            type: "SYSTEM",
            subject: `Task updated: ${updated.title}`,
            actionText: "View task",
            extraUserIds: assigneeId ? [assigneeId] : [],
            excludeUserIds: assigneeId && assigneeId !== task.assigneeId ? [assigneeId] : [],
        });

        emitToProject(req.app.get("io"), req.params.projectId, "task:updated", { projectId: req.params.projectId, task: updated, activity });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update task"));
    }
});

router.post("/:projectId/tasks/:taskId/comments", authorize("comments", "create"), async (req, res) => {
    try {
        const task = await prisma.task.findFirst({ where: { id: req.params.taskId, projectId: req.params.projectId }, include: { project: true } });
        if (!task) return res.status(404).json(errorResponse("NOT_FOUND", "Task not found"));

        const { content } = req.body;
        if (!content?.trim()) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Content is required"));

        const comment = await prisma.comment.create({
            data: { taskId: task.id, authorId: req.user.id, content: content.trim() },
            include: { author: { select: USER_SELECT } },
        });

        const activity = await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: task.projectId, workspaceId: task.project.workspaceId, taskId: task.id, action: "added a comment", entityType: "comment", entityId: comment.id },
            include: { user: { select: USER_SELECT } },
        });

        await notifyUser(req.user.id, {
            title: "Comment added",
            message: `You commented on ${task.title}.`,
            type: "COMMENT",
        });
        await notifyTaskParticipants(task.id, {
            actorId: req.user.id,
            title: "New comment on a task",
            message: `${req.user.name} commented on ${task.title}.`,
            type: "COMMENT",
            subject: `New comment: ${task.title}`,
            actionText: "Read comment",
        });

        emitToProject(req.app.get("io"), req.params.projectId, "task:comment-created", { projectId: req.params.projectId, taskId: task.id, comment, activity });

        const commentOrg = await prisma.workspace.findUnique({
            where: { id: task.project.workspaceId },
            select: { organizationId: true },
        });
        if (commentOrg) {
            deliverOutboundWebhooks({
                organizationId: commentOrg.organizationId,
                eventType: "comment.created",
                payload: {
                    task: { id: task.id, key: task.key, title: task.title },
                    comment: { id: comment.id, content: comment.content },
                    author: { id: comment.authorId, name: req.user.name },
                },
            }).catch(() => {});
        }

        return res.status(201).json(successResponse(comment));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create comment"));
    }
});

export { router as projectsRouter };
