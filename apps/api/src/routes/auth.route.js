import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { planInfoForOrg } from "../lib/entitlements.js";
import { secureEqual } from "../lib/secure-compare.js";
import { verifyTotp, matchRecoveryCode, readTotpSecret } from "../lib/twofa.js";
import {
    createSession,
    ensureSessionForToken,
    hashSessionToken,
    ipBlockedForUser,
    maxSessionAgeForUser,
    passwordMinLengthForUser,
} from "../lib/sessions.js";
import { clientIpFrom } from "../lib/audit.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";
import { signEnrollmentToken } from "../middleware/enrollment.middleware.js";
import { sendTransactionalEmail } from "../services/email.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

// Precomputed bcrypt hash used to equalize login timing when the email does
// not exist (avoids using a timing side-channel to enumerate accounts).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(`dummy-${env.JWT_ACCESS_SECRET.slice(0, 8)}`, 12);

const ACCESS_TOKEN_TTL = "24h";
const REMEMBERED_SESSION_TTL = "30d";
const DEFAULT_SESSION_TTL = "1d";

function signAccessToken(userId) {
    return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL });
}

// `remember` is embedded in the token so refresh rotation preserves the
// chosen session length (30 days when remembered, otherwise 1 day).
function signRefreshToken(userId, remember = false) {
    return jwt.sign({ userId, remember: Boolean(remember) }, env.JWT_REFRESH_SECRET, {
        algorithm: "HS256",
        expiresIn: remember ? REMEMBERED_SESSION_TTL : DEFAULT_SESSION_TTL,
        jwtid: crypto.randomBytes(16).toString("hex"),
    });
}

function sessionDevice(req) {
    return typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
}

async function recordLoginSession({ userId, refreshToken, remember, req }) {
    const maxAge = await maxSessionAgeForUser(userId);
    await createSession({
        userId,
        token: refreshToken,
        remember,
        deviceName: sessionDevice(req),
        ipAddress: clientIpFrom(req),
        sessionMaxAgeDays: maxAge,
    }).catch((e) => {
        console.warn("session save skipped (run prisma db push):", e.message);
    });
}

// Rotates the refresh token while keeping activity on the same session row and
// enforcing the org's security policy (session max age + IP allow-list).
async function rotateSessionForUser({ user, req }) {
    const session = await ensureSessionForToken({
        token: user.refreshToken,
        userId: user.id,
        deviceName: sessionDevice(req),
        ipAddress: clientIpFrom(req),
    });

    if (session && session.expiresAt && session.expiresAt < new Date()) {
        await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken: null } }).catch(() => {});
        throw new Error("session_expired");
    }

    const ip = clientIpFrom(req);
    if (await ipBlockedForUser(user.id, ip)) {
        if (session) await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken: null } }).catch(() => {});
        throw new Error("ip_blocked");
    }

    const decoded = jwt.verify(user.refreshToken, env.JWT_REFRESH_SECRET);
    const newRefreshToken = signRefreshToken(user.id, decoded.remember);

    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } }),
        ...(session
            ? [prisma.userSession.update({
                where: { id: session.id },
                data: { tokenHash: hashSessionToken(newRefreshToken), lastUsedAt: new Date() },
            })]
            : []),
    ]).catch(() => {});

    return { accessToken: signAccessToken(user.id), refreshToken: newRefreshToken };
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

        await recordLoginSession({ userId: user.id, refreshToken, remember: true, req });

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

        await recordLoginSession({ userId: user.id, refreshToken, remember: false, req });

        return res.status(201).json(successResponse({ user, accessToken, refreshToken }));
    } catch (error) {
        return handleAuthError(res, "Register", error, "Registration failed. Please try again.");
    }
});

router.post("/login", authRateLimiter, async (req, res) => {
    try {
        const { email, password, code, recoveryCode, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Email and password are required"));
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
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

        // 2FA enforcement — a valid TOTP or recovery code is required before
        // any tokens are issued.
        if (user.twoFactorEnabled) {
            if (!code && !recoveryCode) {
                return res.status(200).json(successResponse({
                    requiresTwoFactor: true,
                    user: safeUser,
                }));
            }

            let codeValid = verifyTotp(readTotpSecret(user.twoFactorSecret), code);
            if (!codeValid && recoveryCode) {
                const stored = await prisma.recoveryCode.findMany({
                    where: { userId: user.id, usedAt: null },
                    select: { id: true, hashedCode: true, usedAt: true },
                });
                const matchedId = await matchRecoveryCode(recoveryCode, stored);
                if (matchedId) {
                    await prisma.recoveryCode.update({ where: { id: matchedId }, data: { usedAt: new Date() } });
                    codeValid = true;
                }
            }
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

        // Organization-enforced 2FA: members must enrol before a full session
        // is granted. We hand back a short-lived enrolment token so the client
        // can complete setup + verification without exposing the app.
        if (!user.twoFactorEnabled) {
            const enforcing = organizations.filter((m) => m.organization.requireTwoFactor);
            if (enforcing.length > 0) {
                return res.status(403).json({
                    ...errorResponse(
                        "TWO_FACTOR_SETUP_REQUIRED",
                        "Your organization requires two-factor authentication. Enable it to continue.",
                    ),
                    requiresTwoFactorSetup: true,
                    enrollmentToken: signEnrollmentToken(user.id),
                    organizations: enforcing.map((m) => ({ id: m.organization.id, name: m.organization.name })),
                });
            }
        }

        const clientIp = clientIpFrom(req);
        if (await ipBlockedForUser(user.id, clientIp)) {
            return res.status(403).json(errorResponse(
                "IP_BLOCKED",
                "Your IP address is not allowed by your organization's security policy. Contact your admin.",
            ));
        }

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id, rememberMe);

        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch((e) => {
            console.warn("refreshToken save skipped (run prisma migrate):", e.message);
        });

        await recordLoginSession({ userId: user.id, refreshToken, remember: rememberMe, req });

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

            const rotated = await rotateSessionForUser({ user, req });
            return res.status(200).json(successResponse({ accessToken: rotated.accessToken }));
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

        const rotated = await rotateSessionForUser({ user, req });
        return res.status(200).json(successResponse({
            accessToken: rotated.accessToken,
            refreshToken: rotated.refreshToken,
        }));

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

        const minLength = await passwordMinLengthForUser(user.id);
        if (password.length < minLength) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", `Password must be at least ${minLength} characters`));
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

export { router as authRouter, signAccessToken, signRefreshToken, shapeOrganizations };
