import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { errorResponse } from "../utils/api-response.js";

// Derived secret so an enrolment token can never be replayed as a normal
// access token (and vice-versa): the signatures simply won't verify elsewhere.
const ENROLLMENT_SECRET = `${env.JWT_ACCESS_SECRET}:2fa-enrollment`;

/** Short-lived token that ONLY grants access to the 2FA enrolment routes. */
export function signEnrollmentToken(userId) {
    return jwt.sign({ userId, purpose: "2fa-enrollment" }, ENROLLMENT_SECRET, {
        algorithm: "HS256",
        expiresIn: "15m",
    });
}

export function authenticateEnrollment(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "Enrolment session required"));
    }
    try {
        const decoded = jwt.verify(header.slice(7), ENROLLMENT_SECRET);
        if (decoded.purpose !== "2fa-enrollment") throw new Error("invalid purpose");
        req.user = { id: decoded.userId };
        req.enrollmentOnly = true;
        return next();
    } catch {
        return res
            .status(401)
            .json(errorResponse("UNAUTHORIZED", "Enrolment session expired — sign in again"));
    }
}
