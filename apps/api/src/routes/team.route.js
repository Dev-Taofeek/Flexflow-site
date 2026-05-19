import { Router } from "express";
import { Resend } from "resend";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
            invites,
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

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invite = await prisma.invite.create({
            data: { organizationId: workspace.organizationId, invitedById: req.user.id, email, role, expiresAt },
        });

        const inviteUrl = `${process.env.CLIENT_ORIGIN}/join?token=${invite.token}`;

        if (resend) {
            await resend.emails.send({
                from: "FlexFlow <noreply@flexflow.app>",
                to: email,
                subject: `Join ${workspace.organization.name} on FlexFlow`,
                html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                  <h2 style="font-size:20px;font-weight:600;color:#18181b;margin:0 0 8px">You've been invited</h2>
                  <p style="color:#52525b;margin:0 0 24px">${req.user.name} invited you to join <strong>${workspace.organization.name}</strong> on FlexFlow as ${role}.</p>
                  <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500">Accept Invitation</a>
                  <p style="color:#a1a1aa;font-size:12px;margin-top:24px">This invitation expires in 7 days.</p>
                </div>`,
            });
        }

        return res.status(201).json(successResponse(invite));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send invite"));
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

        await prisma.workspaceMember.delete({ where: { id: req.params.memberId } });
        return res.status(200).json(successResponse({ removed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove member"));
    }
});

export { router as teamRouter };
