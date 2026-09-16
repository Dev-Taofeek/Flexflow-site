import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { trackApiUsage } from "../middleware/usage.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);
router.use(trackApiUsage);

const SUPPORTED_PROVIDERS = {
    github: {
        label: "GitHub",
        apiBase: "https://api.github.com",
        validatePath: "/user",
    },
    slack: {
        label: "Slack",
        apiBase: "https://slack.com/api",
        validatePath: "/auth.test",
    },
    figma: {
        label: "Figma",
        apiBase: "https://api.figma.com",
        validatePath: "/v1/me",
    },
};

function maskToken(token) {
    if (!token) return null;
    const value = encryptSecret(token);
    const last4 = token.length > 4 ? token.slice(-4) : "****";
    return { token: value, last4 };
}

function publicConnection(conn) {
    const config = conn.config || {};
    return {
        id: conn.id,
        provider: conn.provider,
        providerLabel: SUPPORTED_PROVIDERS[conn.provider]?.label || conn.provider,
        enabled: conn.enabled,
        config: {
            account: config.account || null,
            ...(config.last4 ? { last4: config.last4 } : {}),
        },
        connectedBy: conn.connectedBy
            ? { id: conn.connectedBy.id, name: conn.connectedBy.name, email: conn.connectedBy.email }
            : null,
        lastSyncedAt: conn.lastSyncedAt,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
    };
}

// GET /api/integrations?orgId=… — list integrations for an organization
router.get("/", requireOrgRole("OWNER", "ADMIN", "MEMBER"), async (req, res) => {
    try {
        const organizationId = req.query.orgId;
        if (!organizationId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "orgId is required"));

        const connections = await prisma.integrationConnection.findMany({
            where: { organizationId },
            include: { connectedBy: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
        });

        return res.status(200).json(successResponse({ connections: connections.map(publicConnection) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to list integrations"));
    }
});

async function validateProviderToken(provider, token) {
    const providerInfo = SUPPORTED_PROVIDERS[provider];
    if (!providerInfo) throw new Error("Unsupported provider");

    const headers = { "Content-Type": "application/json" };
    if (provider === "github") {
        headers.Authorization = `token ${token}`;
        headers["User-Agent"] = "FlexFlow";
        headers["X-GitHub-Api-Version"] = "2022-11-28";
    } else {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${providerInfo.apiBase}${providerInfo.validatePath}`, { headers });
    const json = await res.json().catch(() => ({}));

    if (provider === "github") {
        if (!res.ok || json.message) throw new Error("Invalid GitHub token");
        return {
            account: json.login ? `@${json.login}` : (json.name || "GitHub account"),
            ok: true,
        };
    }

    if (provider === "figma") {
        if (!res.ok || !json.handle) throw new Error("Invalid Figma token");
        return {
            account: json.handle ? `@${json.handle}` : "Figma account",
            ok: true,
        };
    }

    if (!json.ok) throw new Error(json.error || "Invalid Slack token");
    return {
        account: json.user_id ? `workspace ${json.team || ""}`.trim() : "Slack workspace",
        ok: true,
    };
}

// POST /api/integrations — connect a GitHub or Slack account
router.post("/", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { orgId, provider, token, webhookSecret, webhookSigningSecret, webhookPasscode } = req.body;
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "orgId is required"));
        if (!SUPPORTED_PROVIDERS[provider]) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "provider must be github, slack or figma"));
        }
        if (!token || typeof token !== "string" || token.length < 8) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "A valid access token is required"));
        }

        const validation = await validateProviderToken(provider, token).catch(() => null);
        if (!validation) {
            return res.status(401).json(errorResponse("INVALID_TOKEN", "Could not validate the token with the provider"));
        }

        const masked = maskToken(token);
        const config = {
            encryptedToken: masked.token,
            last4: masked.last4,
            account: validation.account || null,
            ...(webhookSecret ? { webhookSecret: String(webhookSecret) } : {}),
            ...(webhookSigningSecret ? { webhookSigningSecret: String(webhookSigningSecret) } : {}),
            ...(webhookPasscode ? { webhookPasscode: String(webhookPasscode) } : {}),
        };

        const existing = await prisma.integrationConnection.findUnique({
            where: { organizationId_provider: { organizationId: orgId, provider } },
        });

        const connection = existing
            ? await prisma.integrationConnection.update({
                  where: { id: existing.id },
                  data: { enabled: true, config, connectedById: req.user.id, lastSyncedAt: new Date() },
              })
            : await prisma.integrationConnection.create({
                  data: {
                      organizationId: orgId,
                      provider,
                      enabled: true,
                      config,
                      connectedById: req.user.id,
                      lastSyncedAt: new Date(),
                  },
              });

        await recordAudit({
            organizationId: orgId,
            actorId: req.user.id,
            action: existing ? "update" : "create",
            resource: "integration",
            metadata: { provider },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ connection: publicConnection(connection) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to connect integration"));
    }
});

// PATCH /api/integrations/:id — toggle enabled state or refresh metadata
router.patch("/:id", async (req, res) => {
    try {
        const { enabled } = req.body;
        const connection = await prisma.integrationConnection.findUnique({ where: { id: req.params.id } });
        if (!connection) return res.status(404).json(errorResponse("NOT_FOUND", "Integration not found"));

        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: connection.organizationId, userId: req.user.id } },
        });
        if (!isMember || !["OWNER", "ADMIN"].includes(isMember.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot modify this integration"));
        }

        const updated = await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: { enabled: enabled === undefined ? connection.enabled : Boolean(enabled) },
            include: { connectedBy: { select: { id: true, name: true, email: true } } },
        });

        return res.status(200).json(successResponse({ connection: publicConnection(updated) }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to update integration"));
    }
});

// POST /api/integrations/:id/test — verify the stored token still works
router.post("/:id/test", async (req, res) => {
    try {
        const connection = await prisma.integrationConnection.findUnique({ where: { id: req.params.id } });
        if (!connection) return res.status(404).json(errorResponse("NOT_FOUND", "Integration not found"));

        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: connection.organizationId, userId: req.user.id } },
        });
        if (!isMember || !["OWNER", "ADMIN"].includes(isMember.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot modify this integration"));
        }

        const token = decryptSecret(connection.config?.encryptedToken);
        if (!token) return res.status(400).json(errorResponse("NO_TOKEN", "No stored token to test"));

        const validation = await validateProviderToken(connection.provider, token).catch(() => null);
        if (!validation) {
            return res.status(401).json(errorResponse("INVALID_TOKEN", "The stored token is no longer valid"));
        }

        return res.status(200).json(successResponse({ ok: true, account: validation.account }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to test integration"));
    }
});

// DELETE /api/integrations/:id — disconnect (remove token + connection)
router.delete("/:id", async (req, res) => {
    try {
        const connection = await prisma.integrationConnection.findUnique({ where: { id: req.params.id } });
        if (!connection) return res.status(404).json(errorResponse("NOT_FOUND", "Integration not found"));

        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: connection.organizationId, userId: req.user.id } },
        });
        if (!isMember || !["OWNER", "ADMIN"].includes(isMember.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot modify this integration"));
        }

        await prisma.integrationConnection.delete({ where: { id: connection.id } });

        await recordAudit({
            organizationId: connection.organizationId,
            actorId: req.user.id,
            action: "delete",
            resource: "integration",
            metadata: { provider: connection.provider },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ deleted: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to disconnect integration"));
    }
});

export { router as integrationsRouter };