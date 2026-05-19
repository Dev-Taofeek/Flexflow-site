import { Router } from "express";
import { Resend } from "resend";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

router.get("/", async (req, res) => {
    try {
        const memberships = await prisma.organizationMember.findMany({
            where: { userId: req.user.id },
            include: {
                organization: {
                    include: {
                        workspaces: { orderBy: { createdAt: "asc" } },
                        _count: { select: { members: true } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const organizations = memberships.map((m) => ({
            ...m.organization,
            role: m.role,
            memberId: m.id,
        }));

        return res.status(200).json(successResponse(organizations));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch organizations"));
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, description, workspaceName } = req.body;

        if (!name?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Organization name is required"));
        }

        const baseSlug = slugify(name);
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.organization.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter++}`;
        }

        const org = await prisma.organization.create({
            data: {
                name: name.trim(),
                slug,
                description: description?.trim() || null,
                members: {
                    create: { userId: req.user.id, role: "OWNER" },
                },
                workspaces: {
                    create: {
                        name: workspaceName?.trim() || "General",
                        slug: `${slug}-general`,
                        members: {
                            create: { userId: req.user.id, role: "OWNER" },
                        },
                    },
                },
            },
            include: {
                workspaces: true,
                members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
            },
        });

        await prisma.user.update({
            where: { id: req.user.id },
            data: { onboarded: true },
        });

        return res.status(201).json(successResponse({ ...org, role: "OWNER" }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create organization"));
    }
});

router.get("/:orgId", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

        const org = await prisma.organization.findUnique({
            where: { id: req.params.orgId },
            include: {
                workspaces: {
                    include: { _count: { select: { members: true, projects: true } } },
                    orderBy: { createdAt: "asc" },
                },
                members: {
                    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
                    orderBy: { createdAt: "asc" },
                },
                invites: {
                    where: { accepted: false, expiresAt: { gt: new Date() } },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { members: true, workspaces: true } },
            },
        });

        return res.status(200).json(successResponse({ ...org, role: membership.role }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch organization"));
    }
});

router.patch("/:orgId", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { name, description, logoUrl } = req.body;
        const org = await prisma.organization.update({
            where: { id: req.params.orgId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(logoUrl !== undefined && { logoUrl }),
            },
        });

        return res.status(200).json(successResponse(org));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update organization"));
    }
});

router.delete("/:orgId", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership || membership.role !== "OWNER") {
            return res.status(403).json(errorResponse("FORBIDDEN", "Only the owner can delete an organization"));
        }

        await prisma.organization.delete({ where: { id: req.params.orgId } });
        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to delete organization"));
    }
});

router.get("/:orgId/members", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member"));

        const members = await prisma.organizationMember.findMany({
            where: { organizationId: req.params.orgId },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true, createdAt: true } } },
            orderBy: { createdAt: "asc" },
        });

        const invites = await prisma.invite.findMany({
            where: { organizationId: req.params.orgId, accepted: false, expiresAt: { gt: new Date() } },
            include: { invitedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json(successResponse({ members, invites }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch members"));
    }
});

router.patch("/:orgId/members/:userId/role", async (req, res) => {
    try {
        const actorMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!actorMembership || !["OWNER", "ADMIN"].includes(actorMembership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { role } = req.body;
        const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
        if (!validRoles.includes(role)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid role"));
        }

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));

        if (actorMembership.role === "ADMIN" && role === "OWNER") {
            return res.status(403).json(errorResponse("FORBIDDEN", "Admins cannot assign Owner role"));
        }

        const updated = await prisma.organizationMember.update({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
            data: { role },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });

        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update member role"));
    }
});

router.delete("/:orgId/members/:userId", async (req, res) => {
    try {
        const actorMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!actorMembership || !["OWNER", "ADMIN"].includes(actorMembership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        if (req.params.userId === req.user.id) {
            return res.status(400).json(errorResponse("BAD_REQUEST", "Cannot remove yourself from the organization"));
        }

        await prisma.organizationMember.delete({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });

        return res.status(200).json(successResponse({ removed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove member"));
    }
});

router.post("/:orgId/invite", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const { email, role = "MEMBER" } = req.body;
        if (!email?.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Valid email is required"));
        }

        const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const already = await prisma.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId: req.params.orgId, userId: existingUser.id } },
            });
            if (already) return res.status(409).json(errorResponse("ALREADY_MEMBER", "User is already a member"));
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invite = await prisma.invite.create({
            data: { organizationId: req.params.orgId, invitedById: req.user.id, email, role, expiresAt },
        });

        const inviteUrl = `${process.env.CLIENT_ORIGIN}/join?token=${invite.token}`;

        if (resend) {
            await resend.emails.send({
                from: "FlexFlow <noreply@flexflow.app>",
                to: email,
                subject: `You've been invited to ${org.name} on FlexFlow`,
                html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                  <h2 style="font-size:20px;font-weight:600;color:#18181b;margin:0 0 8px">You've been invited</h2>
                  <p style="color:#52525b;margin:0 0 24px">${req.user.name} invited you to join <strong>${org.name}</strong> on FlexFlow as ${role}.</p>
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

router.post("/join", async (req, res) => {
    try {
        const { token, inviteCode } = req.body;

        if (token) {
            const invite = await prisma.invite.findUnique({ where: { token } });
            if (!invite || invite.accepted || invite.expiresAt < new Date()) {
                return res.status(400).json(errorResponse("INVALID_INVITE", "Invite is invalid or expired"));
            }

            const already = await prisma.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId: invite.organizationId, userId: req.user.id } },
            });
            if (already) return res.status(409).json(errorResponse("ALREADY_MEMBER", "Already a member"));

            const [, org] = await prisma.$transaction([
                prisma.invite.update({ where: { id: invite.id }, data: { accepted: true } }),
                prisma.organization.update({
                    where: { id: invite.organizationId },
                    data: {
                        members: { create: { userId: req.user.id, role: invite.role } },
                    },
                    include: { workspaces: { orderBy: { createdAt: "asc" } } },
                }),
            ]);

            await prisma.user.update({ where: { id: req.user.id }, data: { onboarded: true } });

            return res.status(200).json(successResponse({ ...org, role: invite.role }));
        }

        if (inviteCode) {
            const org = await prisma.organization.findUnique({
                where: { inviteCode },
                include: { workspaces: { orderBy: { createdAt: "asc" } } },
            });
            if (!org) return res.status(404).json(errorResponse("NOT_FOUND", "Organization not found"));

            const already = await prisma.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId: org.id, userId: req.user.id } },
            });
            if (already) return res.status(409).json(errorResponse("ALREADY_MEMBER", "Already a member of this organization"));

            await prisma.organizationMember.create({
                data: { organizationId: org.id, userId: req.user.id, role: "MEMBER" },
            });

            await prisma.user.update({ where: { id: req.user.id }, data: { onboarded: true } });

            return res.status(200).json(successResponse({ ...org, role: "MEMBER" }));
        }

        return res.status(422).json(errorResponse("VALIDATION_ERROR", "Provide a token or invite code"));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to join organization"));
    }
});

export { router as organizationsRouter };
