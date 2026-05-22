import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { successResponse } from "../utils/api-response.js";

const router = Router();

router.get("/", async (req, res) => {
    return res.status(200).json(
        successResponse({
            status: "ok",
            service: "flexflow-api",
            timestamp: new Date().toISOString(),
        }),
    );
});

// DB connectivity check — visit /api/health/db to diagnose connection issues
router.get("/db", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({
            status: "ok",
            db: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            db: "disconnected",
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

export { router as healthRouter };
