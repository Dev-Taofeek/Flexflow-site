import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { getEmailConfigStatus, isEmailConfigured, sendTransactionalEmail } from "../services/email.service.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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

const VALID_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

function canManageOrgRole(actorRole, targetRole, nextRole) {
    if (targetRole === "OWNER" || nextRole === "OWNER") return false;
    if (actorRole === "OWNER") return true;
    if (actorRole === "ADMIN") return targetRole !== "ADMIN" && nextRole !== "ADMIN";
    return false;
}

router.get("/", async (req, res) => {
    try {
        const memberships = await prisma.organizationMember.findMany({
            where: { userId: req.user.id },
            include: {
                organization: {
                    include: {
                        workspaces: {
                            include: { members: { where: { userId: req.user.id }, select: { role: true } } },
                            orderBy: { createdAt: "asc" },
                        },
                        _count: { select: { members: true } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const organizations = memberships.map((m) => ({
            ...m.organization,
            workspaces: m.organization.workspaces.map((workspace) => ({
                ...workspace,
                role: workspace.members?.[0]?.role || m.role,
                members: undefined,
            })),
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
        const { name, description, workspaceName, logoUrl } = req.body;

        if (!name?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Organization name is required"));
        }

        const existingOwned = await prisma.organizationMember.count({
            where: { userId: req.user.id, role: "OWNER" },
        });
        if (existingOwned >= 1) {
            return res.status(403).json(errorResponse("ORG_LIMIT_REACHED", "Free plan allows creating 1 organization. Upgrade to Premium to create more."));
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
                logoUrl: logoUrl || null,
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

        await notifyUser(req.user.id, {
            title: "Organization created",
            message: `${org.name} was created.`,
            type: "SYSTEM",
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

        await notifyUser(req.user.id, {
            title: "Organization updated",
            message: `${org.name} settings were updated.`,
            type: "SYSTEM",
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

        const org = await prisma.organization.delete({ where: { id: req.params.orgId } });
        await notifyUser(req.user.id, {
            title: "Organization deleted",
            message: `${org.name} was deleted.`,
            type: "SYSTEM",
        });
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

        return res.status(200).json(successResponse({ members, invites: dedupeInvites(invites) }));
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
        if (!VALID_ROLES.includes(role)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid role"));
        }

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));

        if (!canManageOrgRole(actorMembership.role, targetMembership.role, role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot change this member's role"));
        }

        const updated = await prisma.organizationMember.update({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
            data: { role },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });

        await Promise.all([
            notifyUser(req.user.id, {
                title: "Member role updated",
                message: `${updated.user.name} is now ${role}.`,
                type: "INFO",
            }),
            notifyUser(req.params.userId, {
                title: "Your role changed",
                message: `Your organization role is now ${role}.`,
                type: "INFO",
            }),
        ]);

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

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));
        if (targetMembership.role === "OWNER" || (actorMembership.role === "ADMIN" && targetMembership.role === "ADMIN")) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot remove this member"));
        }

        const removed = await prisma.organizationMember.delete({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
            include: { user: { select: { name: true } }, organization: { select: { name: true } } },
        });

        await Promise.all([
            notifyUser(req.user.id, {
                title: "Member removed",
                message: `${removed.user.name} was removed from ${removed.organization.name}.`,
                type: "INFO",
            }),
            notifyUser(req.params.userId, {
                title: "Removed from organization",
                message: `You were removed from ${removed.organization.name}.`,
                type: "INFO",
            }),
        ]);

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
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail?.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Valid email is required"));
        }
        if (!VALID_ROLES.includes(role) || role === "OWNER" || (membership.role === "ADMIN" && role === "ADMIN")) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot invite members with that role"));
        }

        const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            const already = await prisma.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId: req.params.orgId, userId: existingUser.id } },
            });
            if (already) {
                await notifyUser(req.user.id, {
                    title: "Invite not sent",
                    message: `${normalizedEmail} is already a member of this organization.`,
                    type: "INVITE",
                });
                return res.status(409).json(errorResponse("ALREADY_MEMBER", "This user is already a member of this organization"));
            }
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        let invite = await prisma.invite.findFirst({
            where: {
                organizationId: req.params.orgId,
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
                data: { organizationId: req.params.orgId, invitedById: req.user.id, email: normalizedEmail, role, expiresAt },
            });
        }

        const inviteUrl = `${process.env.CLIENT_ORIGIN}/join?token=${invite.token}`;

        let emailSent = false;
        let emailError = null;

        if (isEmailConfigured()) {
            try {
                await sendTransactionalEmail({
                    to: email,
                    subject: `You've been invited to ${org.name} on FlexFlow`,
                    title: "You've been invited",
                    message: `${req.user.name} invited you to join ${org.name} on FlexFlow as ${role}.`,
                    actionText: "Accept invitation",
                    actionUrl: inviteUrl,
                    footer: "This invitation expires in 7 days.",
                });
                emailSent = true;
            } catch (emailErr) {
                emailError = emailErr.message;
                console.error("Invite email failed:", emailErr);
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
            emailConfig: getEmailConfigStatus(),
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send invite"));
    }
});

router.delete("/:orgId/invites/:inviteId", async (req, res) => {
    try {
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "Insufficient permissions"));
        }

        const invite = await prisma.invite.findUnique({ where: { id: req.params.inviteId } });
        if (!invite || invite.organizationId !== req.params.orgId || invite.accepted) {
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

            const firstWorkspace = org.workspaces?.[0];
            if (firstWorkspace) {
                const alreadyInWs = await prisma.workspaceMember.findUnique({
                    where: { workspaceId_userId: { workspaceId: firstWorkspace.id, userId: req.user.id } },
                });
                if (!alreadyInWs) {
                    await prisma.workspaceMember.create({
                        data: { workspaceId: firstWorkspace.id, userId: req.user.id, role: "MEMBER" },
                    });
                }
            }

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

            const firstWorkspaceCode = org.workspaces?.[0];
            if (firstWorkspaceCode) {
                const alreadyInWs = await prisma.workspaceMember.findUnique({
                    where: { workspaceId_userId: { workspaceId: firstWorkspaceCode.id, userId: req.user.id } },
                });
                if (!alreadyInWs) {
                    await prisma.workspaceMember.create({
                        data: { workspaceId: firstWorkspaceCode.id, userId: req.user.id, role: "MEMBER" },
                    });
                }
            }

            return res.status(200).json(successResponse({ ...org, role: "MEMBER" }));
        }

        return res.status(422).json(errorResponse("VALIDATION_ERROR", "Provide a token or invite code"));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to join organization"));
    }
});

export { router as organizationsRouter };
