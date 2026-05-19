import { Router } from "express";

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

export { router as healthRouter };
