import { Router } from "express";
import QRCode from "qrcode";

import { prisma } from "../lib/prisma.js";
import {
    createTotpSecret,
    otpAuthUri,
    verifyTotp,
    readTotpSecret,
    storeTotpSecret,
    generateRecoveryCodes,
    hashRecoveryCode,
} from "../lib/twofa.js";
import { authenticateEnrollment } from "../middleware/enrollment.middleware.js";
import { twoFactorRateLimiter } from "../middleware/rate-limit.middleware.js";
import { signAccessToken, signRefreshToken, shapeOrganizations } from "./auth.route.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticateEnrollment);

// The enrolment token only proves a verified password for an account whose
// organization requires 2FA — it must never expose normal profile data.
router.get("/context", async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, twoFactorEnabled: true },
    });
    if (!user) return res.status(404).json(errorResponse("NOT_FOUND", "User not found"));
    if (user.twoFactorEnabled) {
        return res.status(400).json(errorResponse("ALREADY_ENABLED", "2FA is already enabled — sign in normally"));
    }
    return res.status(200).json(successResponse({ email: user.email, name: user.name }));
});

// POST /api/enrollment/2fa/setup
router.post("/2fa/setup", twoFactorRateLimiter, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, twoFactorEnabled: true },
        });
        if (!user) return res.status(404).json(errorResponse("NOT_FOUND", "User not found"));
        if (user.twoFactorEnabled) {
            return res.status(400).json(errorResponse("ALREADY_ENABLED", "2FA is already enabled"));
        }

        const secret = createTotpSecret();
        const qrCode = await QRCode.toDataURL(otpAuthUri(user.email, secret));

        await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorSecret: storeTotpSecret(secret) } });

        return res.status(200).json(successResponse({ secret, qrCode }));
    } catch (error) {
        console.error("Enrollment 2FA setup error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to setup 2FA"));
    }
});

// POST /api/enrollment/2fa/verify — enrol, then issue a full session.
router.post("/2fa/verify", twoFactorRateLimiter, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(422).json(errorResponse("VALIDATION_ERROR", "Code is required"));

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, email: true, avatarUrl: true, onboarded: true, twoFactorSecret: true,
            },
        });
        if (!user?.twoFactorSecret) {
            return res.status(400).json(errorResponse("NOT_SETUP", "Run setup first"));
        }
        if (!verifyTotp(readTotpSecret(user.twoFactorSecret), code)) {
            return res.status(401).json(errorResponse("INVALID_CODE", "Invalid or expired code — try again"));
        }

        const recoveryCodes = generateRecoveryCodes();
        const hashed = await Promise.all(recoveryCodes.map((value) => hashRecoveryCode(value)));

        await prisma.$transaction([
            prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
            prisma.recoveryCode.createMany({
                data: hashed.map((hashedCode) => ({ userId: user.id, hashedCode })),
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { twoFactorEnabled: true },
            }),
        ]);

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
        const refreshToken = signRefreshToken(user.id, true);
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch(() => {});

        return res.status(200).json(successResponse({
            enabled: true,
            recoveryCodes,
            user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, onboarded: user.onboarded },
            organizations: shapeOrganizations(organizations),
            accessToken,
            refreshToken,
        }));
    } catch (error) {
        console.error("Enrollment 2FA verify error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to enable 2FA"));
    }
});

export { router as enrollmentRouter };
