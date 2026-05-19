import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { errorResponse } from "../utils/api-response.js";

export async function authenticate(req, res, next) {
    try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader?.startsWith("Bearer ")) {
            return res
                .status(401)
                .json(
                    errorResponse(
                        "UNAUTHORIZED",
                        "Authentication token is required",
                    ),
                );
        }

        const token = authorizationHeader.split(" ")[1];
        if (!token) {
            return res
                .status(401)
                .json(
                    errorResponse(
                        "UNAUTHORIZED",
                        "Authentication token is missing",
                    ),
                );
        }

        const decodedToken = jwt.verify(token, env.JWT_ACCESS_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decodedToken.userId },
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                status: true,
                onboarded: true,
            },
        });

        if (!user) {
            return res
                .status(401)
                .json(errorResponse("UNAUTHORIZED", "User session is invalid"));
        }

        if (user.status === "SUSPENDED") {
            return res
                .status(403)
                .json(errorResponse("FORBIDDEN", "Account is suspended"));
        }

        req.user = user;
        next();
    } catch (error) {
        return res
            .status(401)
            .json(
                errorResponse(
                    "UNAUTHORIZED",
                    "Invalid or expired authentication token",
                ),
            );
    }
}
