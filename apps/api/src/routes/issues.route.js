import { Router } from "express";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const router = Router();
router.use(authenticate);

const ISSUE_INCLUDE = {
    project: { select: { id: true, name: true, color: true } },
    assignee: { select: { id: true, name: true, avatarUrl: true } },
    assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    createdBy: { select: { id: true, name: true } },
    labels: { include: { label: true } },
    _count: { select: { comments: true } },
};

// GET /api/issues?workspaceId=...&status=...&priority=...&assigneeId=...&page=1
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

        const [issues, total] = await Promise.all([
            prisma.issue.findMany({
                where,
                include: ISSUE_INCLUDE,
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

// POST /api/issues
router.post("/", async (req, res) => {
    try {
        const { projectId, title, description, priority = "MEDIUM", status = "TODO", assigneeIds = [], dueDate } = req.body;
        if (!projectId || !title?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "projectId and title are required"));
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json(errorResponse("NOT_FOUND", "Project not found"));

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const ids = Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [assigneeIds].filter(Boolean);
        const primaryAssigneeId = ids[0] || null;

        const issue = await prisma.issue.create({
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
            include: ISSUE_INCLUDE,
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

// PATCH /api/issues/:issueId/assignees — update assignees list
router.patch("/:issueId/assignees", async (req, res) => {
    try {
        const { issueId } = req.params;
        const { assigneeIds = [] } = req.body;

        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                project: { select: { workspaceId: true } },
                assignees: { select: { userId: true } },
            },
        });
        if (!issue) return res.status(404).json(errorResponse("NOT_FOUND", "Issue not found"));

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: issue.project.workspaceId, userId: req.user.id } },
        });
        if (!member) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const ids = [...new Set(assigneeIds.filter(Boolean))];
        const primaryId = ids[0] || null;

        // Replace all assignees atomically
        await prisma.$transaction([
            prisma.issueAssignee.deleteMany({ where: { issueId } }),
            ...(ids.length > 0
                ? [prisma.issueAssignee.createMany({ data: ids.map((userId) => ({ issueId, userId })) })]
                : []),
            prisma.issue.update({ where: { id: issueId }, data: { assigneeId: primaryId } }),
        ]);

        // Notify newly added assignees
        const oldIds = new Set((issue.assignees || []).map((a) => a.userId));
        const newlyAdded = ids.filter((id) => !oldIds.has(id));

        if (newlyAdded.length > 0) {
            await Promise.all(newlyAdded.map((userId) =>
                prisma.notification.create({
                    data: {
                        userId,
                        title: "You've been assigned to an issue",
                        message: `You were assigned to: ${issue.title}`,
                        type: "ISSUE_ASSIGNED",
                    },
                })
            ));

            if (resend) {
                const assigneeUsers = await prisma.user.findMany({
                    where: { id: { in: newlyAdded } },
                    select: { email: true, name: true },
                });
                await Promise.all(assigneeUsers.map((u) =>
                    resend.emails.send({
                        from: "FlexFlow <onboarding@resend.dev>",
                        to: u.email,
                        subject: `You've been assigned: ${issue.title}`,
                        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <h2 style="font-size:20px;font-weight:600;color:#18181b;margin:0 0 8px">New assignment</h2>
  <p style="color:#52525b;margin:0 0 8px">Hi ${u.name},</p>
  <p style="color:#52525b;margin:0 0 24px">You've been assigned to the issue: <strong>${issue.title}</strong></p>
  <p style="color:#a1a1aa;font-size:12px;margin-top:24px">Log in to FlexFlow to view this issue.</p>
</div>`,
                    }).catch(() => {})
                ));
            }
        }

        const updated = await prisma.issue.findUnique({ where: { id: issueId }, include: ISSUE_INCLUDE });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update assignees"));
    }
});

export { router as issuesRouter };
