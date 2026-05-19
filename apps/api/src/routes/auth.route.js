import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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

export { router as authRouter };
