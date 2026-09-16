import { Router } from "express";

import { analyticsRouter } from "./analytics.route.js";
import { auditRouter } from "./audit.route.js";
import { authRouter } from "./auth.route.js";
import { billingRouter } from "./billing.route.js";
import { intelligenceRouter } from "./intelligence.route.js";
import { integrationsRouter } from "./integrations.route.js";
import { integrationsWebhooksRouter } from "./integrations-webhooks.route.js";
import { automationsRouter } from "./automations.route.js";
import { tasksRouter } from "./tasks.route.js";
import { dashboardRouter } from "./dashboard.route.js";
import { healthRouter } from "./health.route.js";
import { notificationsRouter } from "./notifications.route.js";
import { organizationsRouter } from "./organizations.route.js";
import { profileRouter } from "./profile.route.js";
import { projectsRouter } from "./projects.route.js";
import { rolesRouter } from "./roles.route.js";
import { searchRouter } from "./search.route.js";
import { teamRouter } from "./team.route.js";
import { workspacesRouter } from "./workspaces.route.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/notifications", notificationsRouter);
router.use("/search", searchRouter);
router.use("/tasks", tasksRouter);
router.use("/organizations", organizationsRouter);
router.use("/workspaces", workspacesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/projects", projectsRouter);
router.use("/roles", rolesRouter);
router.use("/team", teamRouter);
router.use("/analytics", analyticsRouter);
router.use("/audit", auditRouter);
router.use("/billing", billingRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/integrations/webhooks", integrationsWebhooksRouter);
router.use("/integrations", automationsRouter);
router.use("/integrations", integrationsRouter);

export { router };
