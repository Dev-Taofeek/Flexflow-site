import { Router } from "express";

import { analyticsRouter } from "./analytics.route.js";
import { authRouter } from "./auth.route.js";
import { dashboardRouter } from "./dashboard.route.js";
import { healthRouter } from "./health.route.js";
import { organizationsRouter } from "./organizations.route.js";
import { projectsRouter } from "./projects.route.js";
import { rolesRouter } from "./roles.route.js";
import { teamRouter } from "./team.route.js";
import { workspacesRouter } from "./workspaces.route.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/organizations", organizationsRouter);
router.use("/workspaces", workspacesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/projects", projectsRouter);
router.use("/roles", rolesRouter);
router.use("/team", teamRouter);
router.use("/analytics", analyticsRouter);

export { router };
