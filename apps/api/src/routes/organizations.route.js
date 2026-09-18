import { Router } from "express";

import { PLANS } from "@flexflow/plans";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { trackApiUsage } from "../middleware/usage.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { isStepUpSatisfied, requireTwoFactorStepUp } from "../middleware/stepup-2fa.middleware.js";
import { effectivePlanId, getOrgEntitlements, planInfoForOrg } from "../lib/entitlements.js";
import { getEmailConfigStatus, isEmailConfigured, sendTransactionalEmail } from "../services/email.service.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);
router.use(trackApiUsage);

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
            planInfo: planInfoForOrg(m.organization),
            workspaces: m.organization.workspaces
                .filter((workspace) => workspace.members.length > 0)
                .map((workspace) => ({
                    ...workspace,
                    role: workspace.members[0].role,
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

        // ── Plan-based org-count enforcement ────────────────────────────────
        // Free users are limited to a single organization. Creating another one
        // is only possible once they hold a paid (PRO/CUSTOM) org membership,
        // which raises their allowance to the PRO organization limit.
        const memberships = await prisma.organizationMember.findMany({
            where: { userId: req.user.id },
            include: { organization: true },
        });

        const hasPaidOrg = memberships.some((m) => effectivePlanId(m.organization) !== "free");
        const freeOrgCount = memberships.filter((m) => effectivePlanId(m.organization) === "free").length;
        const freeOrgLimit = PLANS.free.limits.organizations;

        if (!hasPaidOrg && freeOrgCount >= freeOrgLimit) {
            return res.status(403).json({
                ...errorResponse(
                    "PLAN_REQUIRED",
                    `You're limited to ${freeOrgLimit} organization on the Free plan. Upgrade an existing organization to Pro to create more.`,
                ),
                data: { code: "PLAN_REQUIRED", feature: "multiple_organizations", planId: "free", upgradeAvailable: true },
            });
        }

        const proOrgLimit = PLANS.pro.limits.organizations;
        if (hasPaidOrg && memberships.length >= proOrgLimit) {
            return res.status(403).json({
                ...errorResponse("LIMIT_REACHED", `You have reached the ${proOrgLimit} organization limit.`),
                data: { code: "LIMIT_REACHED", limitKey: "organizations", limit: proOrgLimit, current: memberships.length, upgradeAvailable: true },
            });
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

        return res.status(201).json(successResponse({ ...org, planInfo: planInfoForOrg(org), role: "OWNER" }));
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
                    // Only include the user's own membership row per workspace so we can
                    // filter to workspaces they actually belong to below — someone being
                    // an org member does not mean they can see every workspace in it.
                    include: {
                        members: { where: { userId: req.user.id }, select: { role: true } },
                        _count: { select: { members: true, projects: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
                members: {
                    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
                    orderBy: { createdAt: "asc" },
                },
                invites: {
                    // Only org-level invites belong on the Organization settings page —
                    // workspace-scoped invites (created from the Team page) are excluded.
                    where: { accepted: false, expiresAt: { gt: new Date() }, workspaceId: null },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { members: true, workspaces: true } },
            },
        });

        // Org OWNER/ADMIN can see every workspace in the org for management purposes,
        // even ones they haven't personally joined. Everyone else only sees workspaces
        // they're actually a member of.
        const canSeeAllWorkspaces = membership.role === "OWNER" || membership.role === "ADMIN";
        const visibleWorkspaces = org.workspaces
            .filter((workspace) => canSeeAllWorkspaces || workspace.members.length > 0)
            .map((workspace) => ({
                ...workspace,
                role: workspace.members[0]?.role ?? null,
                members: undefined,
            }));

        return res.status(200).json(successResponse({
            ...org,
            planInfo: planInfoForOrg(org),
            workspaces: visibleWorkspaces,
            _count: { ...org._count, workspaces: visibleWorkspaces.length },
            role: membership.role,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch organization"));
    }
});

router.patch("/:orgId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { name, description, logoUrl, requireTwoFactor } = req.body;

        // Org-wide 2FA enforcement is security-sensitive: OWNER only, and a
        // fresh step-up code is required when toggling it on or off.
        if (requireTwoFactor !== undefined) {
            if (req.organizationMember.role !== "OWNER") {
                return res.status(403).json(errorResponse("FORBIDDEN", "Only the organization owner can change 2FA enforcement"));
            }
            const stepUpOk = await isStepUpSatisfied(req, req.user.id);
            if (!stepUpOk) {
                return res.status(401).json({
                    ...errorResponse("TWO_FACTOR_REQUIRED", "Enter your two-factor authentication code to continue."),
                    requiresTwoFactor: true,
                });
            }
        }

        const org = await prisma.organization.update({
            where: { id: req.params.orgId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(logoUrl !== undefined && { logoUrl }),
                ...(requireTwoFactor !== undefined && { requireTwoFactor: Boolean(requireTwoFactor) }),
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

router.delete("/:orgId", requireOrgRole("OWNER"), async (req, res) => {
    try {
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
            // Only org-level invites — exclude workspace-scoped invites from the Team page.
            where: { organizationId: req.params.orgId, accepted: false, expiresAt: { gt: new Date() }, workspaceId: null },
            include: { invitedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json(successResponse({ members, invites: dedupeInvites(invites) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch members"));
    }
});

router.patch("/:orgId/members/:userId/role", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { role } = req.body;
        if (!VALID_ROLES.includes(role)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid role"));
        }

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));

        if (!canManageOrgRole(req.organizationMember.role, targetMembership.role, role)) {
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

router.patch("/:orgId/members/:userId/tag", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const raw = typeof req.body?.tag === "string" ? req.body.tag.trim() : "";
        // Strip control characters so the tag can't carry hidden markup.
        const tag = raw.replace(/[\u0000-\u001f\u007f]/g, "");
        if (tag.length > 40) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Member tag cannot exceed 40 characters"));
        }

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));
        if (req.organizationMember.role === "ADMIN" && targetMembership.role === "OWNER") {
            // Admin cannot tag-moderate an owner above their own rank.
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot tag this member"));
        }

        const updated = await prisma.organizationMember.update({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
            data: { tag: tag || null },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });

        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update member tag"));
    }
});

router.delete("/:orgId/members/:userId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        if (req.params.userId === req.user.id) {
            return res.status(400).json(errorResponse("BAD_REQUEST", "Cannot remove yourself from the organization"));
        }

        const targetMembership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.params.userId } },
        });
        if (!targetMembership) return res.status(404).json(errorResponse("NOT_FOUND", "Member not found"));
        if (targetMembership.role === "OWNER" || (req.organizationMember.role === "ADMIN" && targetMembership.role === "ADMIN")) {
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

router.post("/:orgId/invite", requireOrgRole("OWNER", "ADMIN"), requireTwoFactorStepUp, async (req, res) => {
    try {
        const { email, role = "MEMBER" } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail?.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Valid email is required"));
        }
        if (!VALID_ROLES.includes(role) || role === "OWNER" || (req.organizationMember.role === "ADMIN" && role === "ADMIN")) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot invite members with that role"));
        }

        const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });

        // ── Plan-based member-limit enforcement ─────────────────────────────
        const entitlements = getOrgEntitlements(org);
        if (Number.isFinite(entitlements.limits.members)) {
            const [memberCount, pendingInvites] = await Promise.all([
                prisma.organizationMember.count({ where: { organizationId: req.params.orgId } }),
                prisma.invite.count({
                    where: { organizationId: req.params.orgId, workspaceId: null, accepted: false, expiresAt: { gt: new Date() } },
                }),
            ]);
            if (memberCount + pendingInvites + 1 > entitlements.limits.members) {
                return res.status(403).json({
                    ...errorResponse(
                        "LIMIT_REACHED",
                        `You've reached the ${entitlements.limits.members} member limit for the ${org.plan === "FREE" ? "Free" : "Pro"} plan.`,
                    ),
                    data: {
                        code: "LIMIT_REACHED",
                        limitKey: "members",
                        limit: entitlements.limits.members,
                        current: memberCount + pendingInvites,
                        planId: entitlements.planId,
                        upgradeAvailable: true,
                    },
                });
            }
        }

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
        // Scope this lookup to org-level invites only (workspaceId: null) so it never
        // reuses/overwrites a workspace-scoped invite (from the Team page) for the same email.
        let invite = await prisma.invite.findFirst({
            where: {
                organizationId: req.params.orgId,
                workspaceId: null,
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

router.delete("/:orgId/invites/:inviteId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
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

            // Workspace-scoped invite (created from the Team page) — add ONLY to the
            // workspace, never to the organization.
            if (invite.workspaceId) {
                const alreadyInWs = await prisma.workspaceMember.findUnique({
                    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: req.user.id } },
                });
                if (alreadyInWs) return res.status(409).json(errorResponse("ALREADY_MEMBER", "Already a member"));

                const [, workspace] = await prisma.$transaction([
                    prisma.invite.update({ where: { id: invite.id }, data: { accepted: true } }),
                    prisma.workspace.update({
                        where: { id: invite.workspaceId },
                        data: {
                            members: { create: { userId: req.user.id, role: invite.role } },
                        },
                        include: { organization: { select: { id: true, name: true, slug: true } } },
                    }),
                ]);

                await prisma.user.update({ where: { id: req.user.id }, data: { onboarded: true } });

                return res.status(200).json(successResponse({ ...workspace, role: invite.role }));
            }

            // Org-level invite (created from Organization settings) — original behavior:
            // add to the organization, then to the org's first workspace as MEMBER.
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