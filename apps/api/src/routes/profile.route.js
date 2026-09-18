import { Router } from "express";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { twoFactorRateLimiter } from "../middleware/rate-limit.middleware.js";
import { requireTwoFactorStepUp } from "../middleware/stepup-2fa.middleware.js";
import {
    createTotpSecret,
    otpAuthUri,
    verifyTotp,
    readTotpSecret,
    storeTotpSecret,
    generateRecoveryCodes,
    hashRecoveryCode,
    matchRecoveryCode,
} from "../lib/twofa.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const ORG_WIDE_ROLES = new Set(["OWNER", "ADMIN"]);

const router = Router();
router.use(authenticate);

// GET /api/profile — fetch current user profile
router.get("/", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, email: true, avatarUrl: true, bio: true, timezone: true,
                twoFactorEnabled: true,
                _count: { select: { recoveryCodes: { where: { usedAt: null } } } },
            },
        });
        if (!user) return res.status(404).json(errorResponse("NOT_FOUND", "User not found"));
        const { _count, ...rest } = user;
        return res.status(200).json(successResponse({ ...rest, recoveryCodesRemaining: _count?.recoveryCodes ?? 0 }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch profile"));
    }
});

// PATCH /api/profile — update name, bio, avatarUrl, timezone
router.patch("/", async (req, res) => {
    try {
        const { name, bio, avatarUrl, timezone } = req.body;
        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(name?.trim() && { name: name.trim() }),
                ...(bio !== undefined && { bio: bio?.trim() || null }),
                ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
                ...(timezone && { timezone }),
            },
            select: {
                id: true, name: true, email: true, avatarUrl: true,
                bio: true, timezone: true, onboarded: true,
                twoFactorEnabled: true,
            },
        });
        return res.status(200).json(successResponse(updated));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update profile"));
    }
});

// PATCH /api/profile/password — change password
router.patch("/password", requireTwoFactorStepUp, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Both current and new password are required"));
        }
        if (newPassword.length < 8) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "New password must be at least 8 characters"));
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { passwordHash: true },
        });

        if (!user?.passwordHash) {
            return res.status(400).json(errorResponse("NO_PASSWORD", "Your account uses OAuth sign-in — set a password first"));
        }

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
            return res.status(401).json(errorResponse("INVALID_PASSWORD", "Current password is incorrect"));
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } });
        return res.status(200).json(successResponse({ updated: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to change password"));
    }
});

// POST /api/profile/2fa/setup — generate TOTP secret + QR code
router.post("/2fa/setup", twoFactorRateLimiter, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, twoFactorEnabled: true },
        });

        if (user.twoFactorEnabled) {
            return res.status(400).json(errorResponse("ALREADY_ENABLED", "2FA is already enabled"));
        }

        const secret = createTotpSecret();
        const otpauth = otpAuthUri(user.email, secret);
        const qrCode = await QRCode.toDataURL(otpauth);

        // Store the pending secret (encrypted at rest) so verify can use it
        await prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorSecret: storeTotpSecret(secret) },
        });

        return res.status(200).json(successResponse({ secret, qrCode }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to setup 2FA"));
    }
});

// POST /api/profile/2fa/verify — confirm TOTP code and enable 2FA
router.post("/2fa/verify", twoFactorRateLimiter, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Code is required"));

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { twoFactorSecret: true, twoFactorEnabled: true },
        });

        if (!user?.twoFactorSecret) {
            return res.status(400).json(errorResponse("NOT_SETUP", "Run /2fa/setup first"));
        }

        if (!verifyTotp(readTotpSecret(user.twoFactorSecret), code)) {
            return res.status(401).json(errorResponse("INVALID_CODE", "Invalid or expired code — try again"));
        }

        // Enrol + issue a fresh set of single-use recovery codes. Old codes are
        // discarded so a previous batch can never be replayed.
        const recoveryCodes = generateRecoveryCodes();
        const hashed = await Promise.all(recoveryCodes.map((value) => hashRecoveryCode(value)));

        await prisma.$transaction([
            prisma.recoveryCode.deleteMany({ where: { userId: req.user.id } }),
            prisma.recoveryCode.createMany({
                data: hashed.map((hashedCode) => ({ userId: req.user.id, hashedCode })),
            }),
            prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: true } }),
        ]);

        return res.status(200).json(successResponse({ enabled: true, recoveryCodes }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to enable 2FA"));
    }
});

// POST /api/profile/2fa/recovery-codes — regenerate recovery codes (step-up required)
router.post("/2fa/recovery-codes", twoFactorRateLimiter, requireTwoFactorStepUp, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { twoFactorEnabled: true },
        });
        if (!user?.twoFactorEnabled) {
            return res.status(400).json(errorResponse("NOT_ENABLED", "2FA is not enabled"));
        }

        const recoveryCodes = generateRecoveryCodes();
        const hashed = await Promise.all(recoveryCodes.map((value) => hashRecoveryCode(value)));

        await prisma.$transaction([
            prisma.recoveryCode.deleteMany({ where: { userId: req.user.id } }),
            prisma.recoveryCode.createMany({
                data: hashed.map((hashedCode) => ({ userId: req.user.id, hashedCode })),
            }),
        ]);

        return res.status(200).json(successResponse({ recoveryCodes }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to regenerate recovery codes"));
    }
});

// GET /api/profile/:userId — a teammate-visible public profile. Returns the
// target user's profile plus their roles in organizations/workspaces shared
// with the viewer (or all orgs when the viewer is the target themself).
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId || userId.length < 5) {
            return res.status(404).json(errorResponse("NOT_FOUND", "Profile not found"));
        }

        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, avatarUrl: true, bio: true, timezone: true },
        });
        if (!target) return res.status(404).json(errorResponse("NOT_FOUND", "User not found"));

        const [targetMemberships, viewerMemberships] = await Promise.all([
            prisma.organizationMember.findMany({
                where: { userId },
                include: {
                    organization: {
                        include: {
                            workspaces: {
                                include: { members: { where: { userId }, select: { role: true } } },
                                orderBy: { createdAt: "asc" },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            }),
            prisma.organizationMember.findMany({
                where: { userId: req.user.id },
                select: { organizationId: true },
            }),
        ]);

        const viewerOrgIds = new Set(viewerMemberships.map((m) => m.organizationId));
        const isSelf = userId === req.user.id;
        const organizations = targetMemberships
            .filter((m) => isSelf || viewerOrgIds.has(m.organizationId))
            .map((m) => {
                const workspaces = m.organization.workspaces
                    .filter((ws) => ORG_WIDE_ROLES.has(m.role) || (ws.members?.length ?? 0) > 0)
                    .map((ws) => ({ id: ws.id, name: ws.name, role: ws.members?.[0]?.role || m.role }));
                return {
                    id: m.organization.id,
                    name: m.organization.name,
                    logoUrl: m.organization.logoUrl,
                    role: m.role,
                    memberId: m.id,
                    workspaces,
                };
            });

        if (organizations.length === 0 && !isSelf) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You don't share an organization with this user"));
        }

        return res.status(200).json(successResponse({ user: target, organizations }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch profile"));
    }
});

// DELETE /api/profile/2fa — disable 2FA (requires a valid TOTP or recovery code)
router.delete("/2fa", twoFactorRateLimiter, async (req, res) => {
    try {
        const { code } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { twoFactorSecret: true, twoFactorEnabled: true },
        });

        if (!user?.twoFactorEnabled) {
            return res.status(400).json(errorResponse("NOT_ENABLED", "2FA is not currently enabled"));
        }

        let accepted = verifyTotp(readTotpSecret(user.twoFactorSecret), code);
        if (!accepted && code) {
            const codes = await prisma.recoveryCode.findMany({
                where: { userId: req.user.id, usedAt: null },
                select: { id: true, hashedCode: true, usedAt: true },
            });
            const matchedId = await matchRecoveryCode(code, codes);
            if (matchedId) {
                await prisma.recoveryCode.update({ where: { id: matchedId }, data: { usedAt: new Date() } });
                accepted = true;
            }
        }
        if (!accepted) {
            return res.status(401).json(errorResponse("INVALID_CODE", "Invalid code"));
        }

        await prisma.$transaction([
            prisma.recoveryCode.deleteMany({ where: { userId: req.user.id } }),
            prisma.user.update({
                where: { id: req.user.id },
                data: { twoFactorEnabled: false, twoFactorSecret: null },
            }),
        ]);

        return res.status(200).json(successResponse({ disabled: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to disable 2FA"));
    }
});

export { router as profileRouter };
