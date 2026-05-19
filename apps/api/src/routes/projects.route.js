import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

const USER_SELECT = { id: true, name: true, email: true, avatarUrl: true };

async function assertWorkspaceAccess(workspaceId, userId) {
    const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member;
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
                _count: { select: { issues: true } },
                createdBy: { select: USER_SELECT },
                issues: { select: { status: true } },
            },
            orderBy: sort === "name" ? { name: "asc" } : { updatedAt: "desc" },
        });

        const result = projects.map((p) => {
            const total = p.issues.length;
            const done = p.issues.filter((i) => i.status === "DONE").length;
            return { ...p, totalIssues: total, completedIssues: done, progress: total ? Math.round((done / total) * 100) : 0, issues: undefined };
        });

        if (sort === "progress") result.sort((a, b) => b.progress - a.progress);

        return res.status(200).json(successResponse(result));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch projects"));
    }
});

router.post("/", async (req, res) => {
    try {
        const { workspaceId, name, description, color, visibility } = req.body;
        if (!workspaceId || !name?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId and name are required"));
        }

        const member = await assertWorkspaceAccess(workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

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

        return res.status(201).json(successResponse({ ...project, totalIssues: 0, completedIssues: 0, progress: 0 }));
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

        const issues = await prisma.issue.findMany({
            where: { projectId: project.id },
            include: {
                assignee: { select: USER_SELECT },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
                _count: { select: { comments: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json(successResponse({ project, issues }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch project"));
    }
});

router.patch("/:projectId", async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await assertWorkspaceAccess(project.workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

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

        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update project"));
    }
});

router.delete("/:projectId", async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await assertWorkspaceAccess(project.workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        await prisma.project.delete({ where: { id: req.params.projectId } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete project"));
    }
});

router.get("/:projectId/issues/:issueId", async (req, res) => {
    try {
        const issue = await prisma.issue.findFirst({
            where: { id: req.params.issueId, projectId: req.params.projectId },
            include: {
                assignee: { select: USER_SELECT },
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
                project: { include: { workspace: { include: { members: { include: { user: { select: USER_SELECT } } } } } } },
            },
        });

        if (!issue) return res.status(404).json(errorResponse("NOT_FOUND", "Issue not found"));

        const member = await assertWorkspaceAccess(issue.project.workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const labels = await prisma.label.findMany({ where: { workspaceId: issue.project.workspaceId } });

        return res.status(200).json(successResponse({
            issue,
            project: issue.project,
            comments: issue.comments,
            activityLog: issue.activities,
            people: issue.project.workspace.members.map((m) => m.user),
            availableLabels: labels,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch issue"));
    }
});

router.post("/:projectId/issues", async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await assertWorkspaceAccess(project.workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { title, description, priority, status, assigneeId, dueDate } = req.body;
        if (!title?.trim()) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Title is required"));

        const issue = await prisma.issue.create({
            data: {
                projectId: project.id,
                createdById: req.user.id,
                title: title.trim(),
                description: description || null,
                priority: priority || "MEDIUM",
                status: status || "TODO",
                assigneeId: assigneeId || null,
                dueDate: dueDate ? new Date(dueDate) : null,
            },
            include: {
                assignee: { select: USER_SELECT },
                createdBy: { select: USER_SELECT },
                labels: { include: { label: true } },
            },
        });

        await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: project.id, issueId: issue.id, action: "created", entityType: "issue", entityId: issue.id },
        });

        return res.status(201).json(successResponse(issue));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create issue"));
    }
});

router.patch("/:projectId/issues/:issueId/status", async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
        if (!validStatuses.includes(status)) {
            return res.status(422).json(errorResponse("INVALID_STATUS", "Invalid status"));
        }

        const issue = await prisma.issue.findFirst({ where: { id: req.params.issueId, projectId: req.params.projectId }, include: { project: true } });
        if (!issue) return res.status(404).json(errorResponse("NOT_FOUND", "Issue not found"));

        const member = await assertWorkspaceAccess(issue.project.workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const updated = await prisma.issue.update({ where: { id: issue.id }, data: { status }, include: { assignee: { select: USER_SELECT }, labels: { include: { label: true } } } });

        const activity = await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: issue.projectId, issueId: issue.id, action: `changed status to ${status}`, entityType: "issue", entityId: issue.id },
            include: { user: { select: USER_SELECT } },
        });

        req.app.get("io")?.emit("issue:status-updated", { projectId: req.params.projectId, issue: updated, activity });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update status"));
    }
});

router.patch("/:projectId/issues/:issueId", async (req, res) => {
    try {
        const issue = await prisma.issue.findFirst({ where: { id: req.params.issueId, projectId: req.params.projectId }, include: { project: true } });
        if (!issue) return res.status(404).json(errorResponse("NOT_FOUND", "Issue not found"));

        const member = await assertWorkspaceAccess(issue.project.workspaceId, req.user.id);
        if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { title, description, priority, status, assigneeId, dueDate } = req.body;
        const updated = await prisma.issue.update({
            where: { id: issue.id },
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
            data: { userId: req.user.id, projectId: issue.projectId, issueId: issue.id, action: "updated issue", entityType: "issue", entityId: issue.id },
            include: { user: { select: USER_SELECT } },
        });

        req.app.get("io")?.emit("issue:updated", { projectId: req.params.projectId, issue: updated, activity });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update issue"));
    }
});

router.post("/:projectId/issues/:issueId/comments", async (req, res) => {
    try {
        const issue = await prisma.issue.findFirst({ where: { id: req.params.issueId, projectId: req.params.projectId }, include: { project: true } });
        if (!issue) return res.status(404).json(errorResponse("NOT_FOUND", "Issue not found"));

        const member = await assertWorkspaceAccess(issue.project.workspaceId, req.user.id);
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));

        const { content } = req.body;
        if (!content?.trim()) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Content is required"));

        const comment = await prisma.comment.create({
            data: { issueId: issue.id, authorId: req.user.id, content: content.trim() },
            include: { author: { select: USER_SELECT } },
        });

        const activity = await prisma.activityLog.create({
            data: { userId: req.user.id, projectId: issue.projectId, issueId: issue.id, action: "added a comment", entityType: "comment", entityId: comment.id },
            include: { user: { select: USER_SELECT } },
        });

        req.app.get("io")?.emit("issue:comment-created", { projectId: req.params.projectId, issueId: issue.id, comment, activity });
        return res.status(201).json(successResponse(comment));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create comment"));
    }
});

export { router as projectsRouter };
