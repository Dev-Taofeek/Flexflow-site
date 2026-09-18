import { prisma } from "../lib/prisma.js";
import { verifyTotp, matchRecoveryCode, readTotpSecret } from "../lib/twofa.js";
import { errorResponse } from "../utils/api-response.js";

function stepUpCodeFrom(req) {
    const raw = req.headers["x-2fa-code"] || req.body?.twoFactorCode || req.query?.twoFactorCode || req.body?.code;
    return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Returns true when a step-up is not required (user has no 2FA) or when the
 * supplied TOTP/recovery code is valid. Consumes recovery codes on success.
 */
export async function isStepUpSatisfied(req, userId) {
    if (!userId) return false;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    // No personal 2FA enrolled — nothing to step up.
    if (!user?.twoFactorEnabled) return true;

    const code = stepUpCodeFrom(req);
    if (!code) return false;

    if (verifyTotp(readTotpSecret(user.twoFactorSecret), code)) return true;

    const codes = await prisma.recoveryCode.findMany({
        where: { userId, usedAt: null },
        select: { id: true, hashedCode: true, usedAt: true },
    });
    const matchedId = await matchRecoveryCode(code, codes);
    if (!matchedId) return false;

    await prisma.recoveryCode.update({ where: { id: matchedId }, data: { usedAt: new Date() } });
    return true;
}

/**
 * Step-up authentication for sensitive actions.
 *
 * When the signed-in user has 2FA enabled, the request must carry a valid
 * TOTP code (header `x-2fa-code`, or body/query `twoFactorCode`/`code`). A
 * one-time recovery code is also accepted and consumed. Users without 2FA pass
 * through, so this middleware is safe to attach unconditionally.
 *
 * Failure returns HTTP 401 with `requiresTwoFactor: true` so the client can
 * prompt for a code and retry the exact same request.
 */
export async function requireTwoFactorStepUp(req, res, next) {
    try {
        if (await isStepUpSatisfied(req, req.user?.id)) return next();

        if (!req.user?.id) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required"));
        }

        return res.status(401).json({
            ...errorResponse(
                "TWO_FACTOR_REQUIRED",
                "Enter your two-factor authentication code to continue.",
            ),
            requiresTwoFactor: true,
        });
    } catch (error) {
        return next(error);
    }
}
