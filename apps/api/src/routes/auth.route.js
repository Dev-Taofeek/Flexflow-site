import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
import { Router } from "express";

// otplib v13 exposes a functional API (generateSecret, generateURI, verifySync).
// Load via CJS for stable interop across runtimes.
const require = createRequire(import.meta.url);
const { verifySync } = require("otplib");

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { planInfoForOrg } from "../lib/entitlements.js";
import { secureEqual } from "../lib/secure-compare.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";
import { sendTransactionalEmail } from "../services/email.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

// Precomputed bcrypt hash used to equalize login timing when the email does
// not exist (avoids using a timing side-channel to enumerate accounts).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(`dummy-${env.JWT_ACCESS_SECRET.slice(0, 8)}`, 12);

function signAccessToken(userId) {
    return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: "24h" });
}

function signRefreshToken(userId) {
    return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
        algorithm: "HS256",
        expiresIn: "30d",
        jwtid: crypto.randomBytes(16).toString("hex"),
    });
}

// Roles with org-level visibility across every workspace in the org.
const ORG_WIDE_ROLES = new Set(["OWNER", "ADMIN"]);

function filterWorkspacesForRole(workspaces, orgRole) {
    if (ORG_WIDE_ROLES.has(orgRole)) return workspaces;
    return (workspaces || []).filter((workspace) => (workspace.members?.length ?? 0) > 0);
}

function shapeOrganizations(orgMembers) {
    return orgMembers.map((m) => {
        const workspaces = filterWorkspacesForRole(m.organization.workspaces, m.role).map((workspace) => ({
            ...workspace,
            role: workspace.members?.[0]?.role || m.role,
            members: undefined,
        }));

        return {
            ...m.organization,
            planInfo: planInfoForOrg(m.organization),
            workspaces,
            role: m.role,
            memberId: m.id,
        };
    });
}

function handleAuthError(res, label, error, fallbackMessage) {
    console.error(`${label} error:`, {
        name: error.name,
        code: error.code,
        message: error.message,
        meta: error.meta,
    });

    if (error.code === "P2021" || error.code === "P2022") {
        return res.status(500).json(
            errorResponse(
                "DATABASE_SCHEMA_ERROR",
                "Database schema is not ready. Redeploy the API or run Prisma db push.",
            ),
        );
    }

    if (error.code === "P2002") {
        return res.status(409).json(errorResponse("UNIQUE_CONSTRAINT", "This account already exists"));
    }

    return res.status(500).json(errorResponse("SERVER_ERROR", fallbackMessage));
}

// OAuth upsert — called by NextAuth after Google/GitHub sign-in
router.post("/oauth", authRateLimiter, async (req, res) => {
    try {
        // Internal call from NextAuth only — reject OAuth upserts without the shared secret
        const secret = req.headers["x-internal-secret"];
        if (!secret || !secureEqual(secret, env.INTERNAL_SECRET)) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Forbidden"));
        }

        const { email, name, avatarUrl } = req.body;
        if (!email) return res.status(422).json(errorResponse("VALIDATION_ERROR", "email is required"));

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: { name: name || email.split("@")[0], email, avatarUrl: avatarUrl || null, onboarded: false },
                select: { id: true, name: true, email: true, avatarUrl: true, onboarded: true },
            });
        } else {
            // Update avatar if it changed
            if (avatarUrl && avatarUrl !== user.avatarUrl) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { avatarUrl },
                    select: { id: true, name: true, email: true, avatarUrl: true, onboarded: true },
                });
            }
        }

        const organizations = await prisma.organizationMember.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    include: {
                        workspaces: {
                            include: { members: { where: { userId: user.id }, select: { role: true } } },
                            orderBy: { createdAt: "asc" },
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch((e) => {
            console.warn("refreshToken save skipped (run prisma migrate):", e.message);
        });

        return res.status(200).json(successResponse({
            user,
            accessToken,
            refreshToken,
            organizations: shapeOrganizations(organizations),
        }));
    } catch (error) {
        return handleAuthError(res, "OAuth", error, "OAuth sign-in failed");
    }
});

// POST /auth/demo-credentials — returns the seeded demo account's credentials.
// Env-gated: only reachable when DEMO_MODE=true. Never exposes real accounts;
// it simply hands a visitor the well-known demo login so the marketing site
// can offer a frictionless "Try the demo" without hardcoding secrets client-side.
router.post("/demo-credentials", authRateLimiter, async (req, res) => {
    if (!env.DEMO_MODE) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Demo is not enabled"));
    }

    const user = await prisma.user.findFirst({
        where: { email: "demo@flexflow.app" },
        select: { id: true, email: true },
    });
    if (!user) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Demo account not seeded — run prisma db seed"));
    }

    return res.status(200).json(successResponse({
        email: user.email,
        password: "Password123!",
    }));
});

router.post("/register", authRateLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Name, email and password are required"));
        }

        if (password.length < 8) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Password must be at least 8 characters"));
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json(errorResponse("EMAIL_TAKEN", "An account with this email already exists"));
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: { name, email, passwordHash },
            select: { id: true, name: true, email: true, avatarUrl: true, onboarded: true, createdAt: true },
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch((e) => {
            console.warn("refreshToken save skipped (run prisma migrate):", e.message);
        });

        return res.status(201).json(successResponse({ user, accessToken, refreshToken }));
    } catch (error) {
        return handleAuthError(res, "Register", error, "Registration failed. Please try again.");
    }
});

router.post("/login", authRateLimiter, async (req, res) => {
    try {
        const { email, password, code } = req.body;

        if (!email || !password) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Email and password are required"));
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true, name: true, email: true, avatarUrl: true,
                passwordHash: true, onboarded: true, status: true,
                twoFactorEnabled: true, twoFactorSecret: true,
            },
        });

        if (!user || !user.passwordHash) {
            // Equalize timing with real accounts so missing emails can't be
            // enumerated via response latency.
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => {});
            return res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password"));
        }

        if (user.status === "SUSPENDED") {
            return res.status(403).json(errorResponse("ACCOUNT_SUSPENDED", "Your account has been suspended"));
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password"));
        }

        const safeUser = { ...user };
        delete safeUser.passwordHash;
        delete safeUser.twoFactorSecret;

        // 2FA enforcement — a valid TOTP code is required before any tokens are issued
        if (user.twoFactorEnabled) {
            if (!code) {
                return res.status(200).json(successResponse({
                    requiresTwoFactor: true,
                    user: safeUser,
                }));
            }

            const codeValid = user.twoFactorSecret && verifySync({ token: code, secret: user.twoFactorSecret }).valid;
            if (!codeValid) {
                return res.status(401).json(errorResponse("INVALID_CODE", "Invalid or expired code — try again"));
            }
        }

        const organizations = await prisma.organizationMember.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    include: {
                        workspaces: {
                            include: { members: { where: { userId: user.id }, select: { role: true } } },
                            orderBy: { createdAt: "asc" },
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch((e) => {
            console.warn("refreshToken save skipped (run prisma migrate):", e.message);
        });

        return res.status(200).json(successResponse({
            user: safeUser,
            organizations: shapeOrganizations(organizations),
            accessToken,
            refreshToken,
        }));
    } catch (error) {
        return handleAuthError(res, "Login", error, "Login failed");
    }
});

router.post("/refresh", authRateLimiter, async (req, res) => {
    try {
        const { userId } = req.body;

        // Internal call from NextAuth — authenticate with shared secret
        if (userId) {
            const secret = req.headers["x-internal-secret"];
            if (!secret || !secureEqual(secret, env.INTERNAL_SECRET)) {
                return res.status(401).json(errorResponse("UNAUTHORIZED", "Forbidden"));
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, status: true, refreshToken: true },
            });

            if (!user || user.status === "SUSPENDED" || !user.refreshToken) {
                return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid session"));
            }

            jwt.verify(user.refreshToken, env.JWT_REFRESH_SECRET);
            const accessToken = signAccessToken(user.id);

            // Rotate the refresh token so the 30-day session slides forward on activity
            const newRefreshToken = signRefreshToken(user.id);
            await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } }).catch(() => {});

            return res.status(200).json(successResponse({ accessToken }));
        }

        // Legacy: refresh token passed in body (old cookies still in the wild)
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Refresh token required"));
        }

        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, status: true, refreshToken: true },
        });

        if (!user || user.status === "SUSPENDED" || !user.refreshToken || user.refreshToken !== refreshToken) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid session"));
        }

        const accessToken = signAccessToken(user.id);

        // Rotate the refresh token so an absorbed token cannot be replayed.
        const newRefreshToken = signRefreshToken(user.id);
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } }).catch(() => {});

        return res.status(200).json(successResponse({ accessToken, refreshToken: newRefreshToken }));
    } catch {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid or expired refresh token"));
    }
});

router.get("/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required"));
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true, name: true, email: true, avatarUrl: true,
                bio: true, timezone: true, onboarded: true, createdAt: true,
                status: true,
            },
        });

        if (!user) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"));
        }

        if (user.status === "SUSPENDED") {
            return res.status(403).json(errorResponse("ACCOUNT_SUSPENDED", "Your account has been suspended"));
        }

        const memberships = await prisma.organizationMember.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    include: {
                        workspaces: {
                            include: { members: { where: { userId: user.id }, select: { role: true } } },
                            orderBy: { createdAt: "asc" },
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const organizations = shapeOrganizations(memberships);

        return res.status(200).json(successResponse({ user, organizations }));
    } catch {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid or expired token"));
    }
});

router.post("/forgot-password", authRateLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Valid email required"));
        }

        const user = await prisma.user.findUnique({ where: { email } });
        // Always respond 200 so we don't leak whether the email exists
        if (!user) return res.status(200).json(successResponse({ sent: true }));

        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordResetToken: token, passwordResetExpiry: expiry },
        });

        const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password?token=${token}`;

        try {
            await sendTransactionalEmail({
                to: email,
                subject: "Reset your FlexFlow password",
                title: "Reset your password",
                message: "Click the button below to reset your FlexFlow password. This link expires in 1 hour.",
                actionText: "Reset password",
                actionUrl: resetUrl,
                footer: "If you didn't request this, you can safely ignore this email.",
            });
        } catch (emailErr) {
            console.error("Password reset email failed:", emailErr);
        }

        return res.status(200).json(successResponse({ sent: true }));
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send reset email"));
    }
});

router.post("/reset-password", authRateLimiter, async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Token and password are required"));
        }
        if (password.length < 8) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Password must be at least 8 characters"));
        }

        const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
        if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
            return res.status(400).json(errorResponse("INVALID_TOKEN", "Reset link is invalid or has expired"));
        }

        const hash = await bcrypt.hash(password, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hash, passwordResetToken: null, passwordResetExpiry: null },
        });

        return res.status(200).json(successResponse({ reset: true }));
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to reset password"));
    }
});

export { router as authRouter };
