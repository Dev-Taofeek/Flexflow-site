import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

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
router.patch("/password", async (req, res) => {
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
router.post("/2fa/setup", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, twoFactorEnabled: true },
        });

        if (user.twoFactorEnabled) {
            return res.status(400).json(errorResponse("ALREADY_ENABLED", "2FA is already enabled"));
        }

        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, "FlexFlow", secret);
        const qrCode = await QRCode.toDataURL(otpauth);

        // Store the pending secret so verify can use it
        await prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorSecret: secret },
        });

        return res.status(200).json(successResponse({ secret, qrCode }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to setup 2FA"));
    }
});

// POST /api/profile/2fa/verify — confirm TOTP code and enable 2FA
router.post("/2fa/verify", async (req, res) => {
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

        const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
        if (!valid) {
            return res.status(401).json(errorResponse("INVALID_CODE", "Invalid or expired code — try again"));
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorEnabled: true },
        });

        return res.status(200).json(successResponse({ enabled: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to enable 2FA"));
    }
});

// DELETE /api/profile/2fa — disable 2FA (requires valid TOTP code)
router.delete("/2fa", async (req, res) => {
    try {
        const { code } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { twoFactorSecret: true, twoFactorEnabled: true },
        });

        if (!user?.twoFactorEnabled) {
            return res.status(400).json(errorResponse("NOT_ENABLED", "2FA is not currently enabled"));
        }

        const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
        if (!valid) {
            return res.status(401).json(errorResponse("INVALID_CODE", "Invalid code"));
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorEnabled: false, twoFactorSecret: null },
        });

        return res.status(200).json(successResponse({ disabled: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to disable 2FA"));
    }
});

export { router as profileRouter };
