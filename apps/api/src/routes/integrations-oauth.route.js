import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { encryptSecret } from "../lib/crypto.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import {
    OAUTH_PROVIDERS,
    oauthConfigured,
    signOAuthState,
    verifyOAuthState,
    buildAuthorizeUrl,
    exchangeOAuthCode,
} from "../lib/integration-oauth.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();

const INTEGRATIONS_PATH = "/settings/integrations";

function clientRedirect(query) {
    const base = `${process.env.CLIENT_ORIGIN || ""}${INTEGRATIONS_PATH}`;
    return `${base}?${new URLSearchParams(query).toString()}`;
}

// GET /api/integrations/oauth/:provider/start?orgId=… — returns the provider
// authorize URL (the client redirects the browser to it).
router.get("/:provider/start", authenticate, async (req, res) => {
    try {
        const { provider } = req.params;
        const orgId = req.query.orgId;
        if (!OAUTH_PROVIDERS[provider]) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Unsupported provider"));
        }
        if (!orgId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "orgId is required"));
        if (!oauthConfigured(provider)) {
            return res.status(501).json(errorResponse("OAUTH_NOT_CONFIGURED", "OAuth is not configured for this provider"));
        }

        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId: req.user.id } },
        });
        if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You cannot connect integrations for this organization"));
        }

        const state = signOAuthState({ provider, organizationId: orgId, userId: req.user.id });
        return res.status(200).json(successResponse({ url: buildAuthorizeUrl({ provider, state }) }));
    } catch (error) {
        console.error("OAuth start error:", error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to start OAuth flow"));
    }
});

// GET /api/integrations/oauth/:provider/callback — provider redirect target.
// Unauthenticated by design; trust is established via the signed `state`.
router.get("/:provider/callback", async (req, res) => {
    const { provider } = req.params;
    const { code, state, error: providerError } = req.query;

    if (!OAUTH_PROVIDERS[provider]) return res.redirect(clientRedirect({ integration: "error" }));
    if (providerError || !code || !state) {
        return res.redirect(clientRedirect({ integration: "error", provider, reason: String(providerError || "missing_code") }));
    }

    try {
        const decoded = verifyOAuthState(String(state));
        if (decoded.provider !== provider) throw new Error("provider mismatch");

        const { accessToken, account } = await exchangeOAuthCode(provider, String(code));
        const config = {
            encryptedToken: encryptSecret(accessToken),
            last4: accessToken.slice(-4),
            account: account || null,
            via: "oauth",
        };

        const existing = await prisma.integrationConnection.findUnique({
            where: { organizationId_provider: { organizationId: decoded.organizationId, provider } },
        });

        if (existing) {
            await prisma.integrationConnection.update({
                where: { id: existing.id },
                data: {
                    enabled: true,
                    config: { ...(existing.config || {}), ...config },
                    connectedById: decoded.userId,
                    lastSyncedAt: new Date(),
                },
            });
        } else {
            await prisma.integrationConnection.create({
                data: {
                    organizationId: decoded.organizationId,
                    provider,
                    enabled: true,
                    config,
                    connectedById: decoded.userId,
                    lastSyncedAt: new Date(),
                },
            });
        }

        await recordAudit({
            organizationId: decoded.organizationId,
            actorId: decoded.userId,
            action: existing ? "update" : "create",
            resource: "integration",
            metadata: { provider, via: "oauth" },
            ipAddress: clientIpFrom(req),
        });

        return res.redirect(clientRedirect({ integration: "connected", provider }));
    } catch (error) {
        console.error("OAuth callback error:", error?.message);
        return res.redirect(clientRedirect({ integration: "error", provider }));
    }
});

export { router as integrationsOauthRouter };
