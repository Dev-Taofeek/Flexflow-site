import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { isEmailConfigured, sendTransactionalEmail } from "../services/email.service.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

function dedupeInvites(invites) {
    const byEmail = new Map();
    for (const invite of invites) {
        const key = invite.email.toLowerCase();
        if (!byEmail.has(key)) {
            byEmail.set(key, invite);
        }
    }
    return [...byEmail.values()];
}

router.get("/", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self) return res.status(403).json(errorResponse("FORBIDDEN", "Not a workspace member"));

        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

        const [members, invites] = await Promise.all([
            prisma.workspaceMember.findMany({
                where: { workspaceId },
                include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true, createdAt: true } } },
                orderBy: { createdAt: "asc" },
            }),
            prisma.invite.findMany({
                where: { organizationId: workspace.organizationId, accepted: false, expiresAt: { gt: new Date() } },
                include: { invitedBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        return res.status(200).json(successResponse({
            members: members.map((m) => ({ ...m.user, role: m.role, memberId: m.id, joinedAt: m.createdAt })),
            invites: dedupeInvites(invites),
            roles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
            currentUserRole: self.role,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch team"));
    }
});

router.post("/invite", async (req, res) => {
    try {
        const { workspaceId, email, role = "MEMBER" } = req.body;
        if (!workspaceId || !email?.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId and valid email are required"));
        }

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self || !["OWNER", "ADMIN"].includes(self.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { organization: true },
        });

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            const existingMember = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
            });
            if (existingMember) {
                await notifyUser(req.user.id, {
                    title: "Invite not sent",
                    message: `${normalizedEmail} is already a member of this workspace.`,
                    type: "INVITE",
                });
                return res.status(409).json(errorResponse("ALREADY_MEMBER", "This user is already a member of this workspace"));
            }
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        let invite = await prisma.invite.findFirst({
            where: {
                organizationId: workspace.organizationId,
                email: normalizedEmail,
                accepted: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        const resent = Boolean(invite);

        if (invite) {
            invite = await prisma.invite.update({
                where: { id: invite.id },
                data: { role, expiresAt, invitedById: req.user.id },
            });
        } else {
            invite = await prisma.invite.create({
                data: { organizationId: workspace.organizationId, invitedById: req.user.id, email: normalizedEmail, role, expiresAt },
            });
        }

        const inviteUrl = `${process.env.CLIENT_ORIGIN}/join?token=${invite.token}`;

        let emailSent = false;
        let emailError = null;

        if (isEmailConfigured()) {
            try {
                await sendTransactionalEmail({
                    to: email,
                    subject: `Join ${workspace.organization.name} on FlexFlow`,
                    title: "You've been invited",
                    message: `${req.user.name} invited you to join ${workspace.organization.name} on FlexFlow as ${role}.`,
                    actionText: "Accept invitation",
                    actionUrl: inviteUrl,
                    footer: "This invitation expires in 7 days.",
                });
                emailSent = true;
            } catch (emailErr) {
                emailError = emailErr.message;
                console.error("Team invite email failed:", emailErr);
            }
        }

        await notifyUser(req.user.id, {
            title: resent ? "Invite resent" : "Invite created",
            message: emailSent
                ? `Invitation email sent to ${normalizedEmail}.`
                : `Invite link created for ${normalizedEmail}, but EmailJS is not configured.`,
            type: "INVITE",
        });

        return res.status(201).json(successResponse({
            ...invite,
            inviteUrl,
            emailSent,
            resent,
            emailError: emailError || (!isEmailConfigured() ? "EMAILJS_NOT_CONFIGURED" : null),
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send invite"));
    }
});

router.delete("/invites/:inviteId", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self || !["OWNER", "ADMIN"].includes(self.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        const invite = await prisma.invite.findUnique({ where: { id: req.params.inviteId } });
        if (!workspace || !invite || invite.organizationId !== workspace.organizationId || invite.accepted) {
            return res.status(404).json(errorResponse("NOT_FOUND", "Invitation not found"));
        }

        await prisma.invite.delete({ where: { id: invite.id } });
        await notifyUser(req.user.id, {
            title: "Invitation cancelled",
            message: `Invitation for ${invite.email} was cancelled.`,
            type: "INVITE",
        });
        return res.status(200).json(successResponse({ deleted: true, id: invite.id }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to cancel invite"));
    }
});

router.patch("/members/:memberId/role", async (req, res) => {
    try {
        const { workspaceId, role } = req.body;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self || !["OWNER", "ADMIN"].includes(self.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
        if (!validRoles.includes(role)) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid role"));

        const target = await prisma.workspaceMember.findUnique({ where: { id: req.params.memberId } });
        if (!target) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));

        const updated = await prisma.workspaceMember.update({
            where: { id: req.params.memberId },
            data: { role },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });

        await Promise.all([
            notifyUser(req.user.id, {
                title: "Workspace role updated",
                message: `${updated.user.name} is now ${role}.`,
                type: "INFO",
            }),
            notifyUser(updated.user.id, {
                title: "Your workspace role changed",
                message: `Your workspace role is now ${role}.`,
                type: "INFO",
            }),
        ]);

        return res.status(200).json(successResponse({ ...updated.user, role: updated.role, memberId: updated.id }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update role"));
    }
});

router.delete("/members/:memberId", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const self = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });
        if (!self || !["OWNER", "ADMIN"].includes(self.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const target = await prisma.workspaceMember.findUnique({ where: { id: req.params.memberId } });
        if (!target) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));

        if (target.userId === req.user.id) {
            return res.status(400).json(errorResponse("BAD_REQUEST", "Cannot remove yourself"));
        }

        const removed = await prisma.workspaceMember.delete({
            where: { id: req.params.memberId },
            include: { user: { select: { id: true, name: true } }, workspace: { select: { name: true } } },
        });
        await Promise.all([
            notifyUser(req.user.id, {
                title: "Workspace member removed",
                message: `${removed.user.name} was removed from ${removed.workspace.name}.`,
                type: "INFO",
            }),
            notifyUser(removed.user.id, {
                title: "Removed from workspace",
                message: `You were removed from ${removed.workspace.name}.`,
                type: "INFO",
            }),
        ]);
        return res.status(200).json(successResponse({ removed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove member"));
    }
});

export { router as teamRouter };
