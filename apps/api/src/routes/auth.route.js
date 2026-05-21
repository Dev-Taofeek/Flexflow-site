import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { Router } from "express";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

function signAccessToken(userId) {
    return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function signRefreshToken(userId) {
    return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

// OAuth upsert — called by NextAuth after Google/GitHub sign-in
router.post("/oauth", async (req, res) => {
    try {
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
                organization: { include: { workspaces: { orderBy: { createdAt: "asc" } } } },
            },
            orderBy: { createdAt: "asc" },
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        return res.status(200).json(successResponse({
            user,
            accessToken,
            refreshToken,
            organizations: organizations.map((m) => ({
                ...m.organization,
                role: m.role,
                memberId: m.id,
            })),
        }));
    } catch (error) {
        console.error("OAuth error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "OAuth sign-in failed"));
    }
});

router.post("/register", async (req, res) => {
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

        return res.status(201).json(successResponse({ user, accessToken, refreshToken }));
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Registration failed"));
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Email and password are required"));
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true, name: true, email: true, avatarUrl: true,
                passwordHash: true, onboarded: true, status: true,
            },
        });

        if (!user || !user.passwordHash) {
            return res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password"));
        }

        if (user.status === "SUSPENDED") {
            return res.status(403).json(errorResponse("ACCOUNT_SUSPENDED", "Your account has been suspended"));
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password"));
        }

        const { passwordHash: _, ...safeUser } = user;

        const organizations = await prisma.organizationMember.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    include: { workspaces: { orderBy: { createdAt: "asc" } } },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        return res.status(200).json(successResponse({
            user: safeUser,
            organizations: organizations.map((m) => ({
                ...m.organization,
                role: m.role,
                memberId: m.id,
            })),
            accessToken,
            refreshToken,
        }));
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Login failed"));
    }
});

router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Refresh token required"));
        }

        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, status: true },
        });

        if (!user || user.status === "SUSPENDED") {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid session"));
        }

        const accessToken = signAccessToken(user.id);
        return res.status(200).json(successResponse({ accessToken }));
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
            },
        });

        if (!user) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "User not found"));
        }

        const memberships = await prisma.organizationMember.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    include: { workspaces: { orderBy: { createdAt: "asc" } } },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const organizations = memberships.map((m) => ({
            ...m.organization,
            role: m.role,
            memberId: m.id,
        }));

        return res.status(200).json(successResponse({ user, organizations }));
    } catch {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid or expired token"));
    }
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

router.post("/forgot-password", async (req, res) => {
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

        if (resend) {
            await resend.emails.send({
                from: "FlexFlow <onboarding@resend.dev>",
                to: email,
                subject: "Reset your FlexFlow password",
                html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <h2 style="font-size:20px;font-weight:600;color:#18181b;margin:0 0 8px">Reset your password</h2>
  <p style="color:#52525b;margin:0 0 24px">Click the button below to reset your FlexFlow password. This link expires in 1 hour.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500">Reset password</a>
  <p style="color:#a1a1aa;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
</div>`,
            });
        }

        return res.status(200).json(successResponse({ sent: true }));
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to send reset email"));
    }
});

router.post("/reset-password", async (req, res) => {
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
