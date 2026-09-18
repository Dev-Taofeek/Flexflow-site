import rateLimit from "express-rate-limit";

import { errorResponse } from "../utils/api-response.js";

export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
        return res
            .status(429)
            .json(
                errorResponse(
                    "RATE_LIMIT_EXCEEDED",
                    "Too many authentication attempts. Please try again later.",
                ),
            );
    },
});

// Tighter budget for 2FA setup/verify/step-up. Keyed by user when available so
// one shared IP cannot exhaust another account's allowance.
export const twoFactorRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
    handler(req, res) {
        return res
            .status(429)
            .json(
                errorResponse(
                    "RATE_LIMIT_EXCEEDED",
                    "Too many verification attempts. Please try again in a few minutes.",
                ),
            );
    },
});
