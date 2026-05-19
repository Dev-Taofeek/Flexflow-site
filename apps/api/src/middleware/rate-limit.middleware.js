import rateLimit from "express-rate-limit";

import { errorResponse } from "./tils/api-response.js";

export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
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
