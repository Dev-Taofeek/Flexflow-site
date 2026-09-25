import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Router } from "express";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { secureEqual } from "../lib/secure-compare.js";
import { clientIpFrom, recordAudit } from "../lib/audit.js";
import { ipBlockedForUser, maxSessionAgeForUser } from "../lib/sessions.js";
import {
    oidcDiscover,
    buildAuthorizeUrl,
    exchangeCode,
    fetchUserInfo,
    emailFromUserInfo,
    nameFromUserInfo,
    domainFromEmail,
    isEmailVerified,
} from "../lib/oidc.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { authRateLimiter } from "../middleware/rate-limit.middleware.js";
import { enforceFeature } from "../lib/entitlements.js";
import { signEnrollmentToken } from "../middleware/enrollment.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";
import { signAccessToken, signRefreshToken } from "./auth.route.js";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

function signSsoState({ ssoId, organizationId, email }) {
    return jwt.sign({ ssoId, organizationId, email, purpose: "sso-state" }, env.INTERNAL_SECRET, {
        expiresIn: "5m",
    });
}

function verifySsoState(state) {
    const decoded = jwt.verify(state, env.INTERNAL_SECRET);
    if (decoded.purpose !== "sso-state") throw new Error("invalid state");
    return decoded;
}

function signSsoGrant({ userId, email, organizationId, organizationName, enrollmentRequired }) {
    return jwt.sign(
        { userId, email, organizationId, organizationName, enrollmentRequired: Boolean(enrollmentRequired), purpose: "sso-grant" },
        env.INTERNAL_SECRET,
        { expiresIn: "10m" },
    );
}

function verifySsoGrant(grant) {
    const decoded = jwt.verify(grant, env.INTERNAL_SECRET);
    if (decoded.purpose !== "sso-grant") throw new Error("invalid grant");
    return decoded;
}

function ssoRedirectUrl(params) {
    const url = new URL("/login", CLIENT_ORIGIN.replace(/\/$/, ""));
    url.searchParams.set("sso", "1");
    for (const [key, value] of Object.entries(params || {})) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

const router = Router();

router.post("/start", authRateLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (typeof email !== "string" || !email.includes("@")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "Valid email required"));
        }
        const domain = domainFromEmail(email);
        const sso = await prisma.organizationSso.findFirst({
            where: { domain, enabled: true },
            select: { id: true, organizationId: true, discoveryUrl: true, clientId: true },
        });
        if (!sso) {
            return res.status(200).json(successResponse({ found: false }));
        }

        const discovery = await oidcDiscover(sso.discoveryUrl);
        const state = signSsoState({ ssoId: sso.id, organizationId: sso.organizationId, email: email.toLowerCase() });
        const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
        const url = buildAuthorizeUrl({
            discovery,
            clientId: sso.clientId,
            redirectUri: `${base}/api/auth/sso/callback`,
            state,
            domainHint: domain,
        });

        return res.status(200).json(successResponse({ found: true, url }));
    } catch (error) {
        console.error("SSO start error:", error.message);
        return res.status(200).json(successResponse({ found: false, error: error.message }));
    }
});

router.get("/callback", async (req, res) => {
    try {
        const { state, code, error } = req.query;
        if (error || !state || !code) {
            return res.redirect(ssoRedirectUrl({ error: "1" }));
        }

        let payload;
        try {
            payload = verifySsoState(state);
        } catch {
            return res.redirect(ssoRedirectUrl({ error: "2" }));
        }

        const sso = await prisma.organizationSso.findUnique({
            where: { id: payload.ssoId },
            include: { organization: true },
        });
        if (!sso || !sso.enabled) {
            return res.redirect(ssoRedirectUrl({ error: "3" }));
        }

        const discovery = await oidcDiscover(sso.discoveryUrl);
        const tokens = await exchangeCode({
            discovery,
            clientId: sso.clientId,
            clientSecret: sso.clientSecret,
            redirectUri: `${(process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "")}/api/auth/sso/callback`,
            code,
        });
        const accessToken = tokens.access_token || tokens.id_token;
        if (!accessToken) {
            return res.redirect(ssoRedirectUrl({ error: "4" }));
        }

        const info = await fetchUserInfo(discovery, accessToken);
        const email = emailFromUserInfo(info);
        if (!email || email !== payload.email) {
            return res.redirect(ssoRedirectUrl({ error: "5" }));
        }
        const domain = domainFromEmail(email);
        if (!domain || domain !== sso.domain.toLowerCase()) {
            return res.redirect(ssoRedirectUrl({ error: "5" }));
        }
        if (!isEmailVerified(info)) {
            return res.redirect(ssoRedirectUrl({ error: "6" }));
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: nameFromUserInfo(info),
                    email,
                    onboarded: false,
                },
                select: { id: true, name: true, email: true, avatarUrl: true, onboarded: true, twoFactorEnabled: true },
            });
        } else {
            user = await prisma.user.findUnique({
                where: { id: user.id },
                select: { id: true, name: true, email: true, avatarUrl: true, onboarded: true, twoFactorEnabled: true },
            });
        }

        const existing = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: sso.organizationId, userId: user.id } },
            select: { id: true },
        });
        if (!existing) {
            await prisma.organizationMember.create({
                data: { organizationId: sso.organizationId, userId: user.id, role: "MEMBER" },
            });
            await recordAudit({
                organizationId: sso.organizationId,
                actorId: user.id,
                action: "SSO_PROVISIONED",
                resource: "user",
                resourceId: user.id,
                metadata: { provider: sso.provider, domain: sso.domain },
                ipAddress: clientIpFrom(req),
            });
        }

        const enrollmentRequired = sso.organization.requireTwoFactor && !user.twoFactorEnabled;
        const grant = signSsoGrant({
            userId: user.id,
            email,
            organizationId: sso.organizationId,
            organizationName: sso.organization.name,
            enrollmentRequired,
        });

        return res.redirect(ssoRedirectUrl({ grant, ...(enrollmentRequired ? { enroll: "1" } : {}) }));
    } catch (error) {
        console.error("SSO callback error:", error.message);
        return res.redirect(ssoRedirectUrl({ error: "7" }));
    }
});

router.post("/status", authRateLimiter, async (req, res) => {
    try {
        const { grant, email } = req.body;
        const decoded = verifySsoGrant(grant);
        if (typeof email !== "string" || decoded.email !== email.toLowerCase()) {
            return res.status(400).json(errorResponse("INVALID_GRANT", "Grant does not match this email"));
        }
        return res.status(200).json(successResponse({
            ready: !decoded.enrollmentRequired,
            requiresTwoFactorSetup: decoded.enrollmentRequired,
            organizations: [{ id: decoded.organizationId, name: decoded.organizationName }],
            ...(decoded.enrollmentRequired
                ? { enrollmentToken: signEnrollmentToken(decoded.userId) }
                : {}),
        }));
    } catch {
        return res.status(400).json(errorResponse("INVALID_GRANT", "Grant is invalid or has expired"));
    }
});

router.post("/import", authRateLimiter, async (req, res) => {
    try {
        const secret = req.headers["x-internal-secret"];
        if (!secret || !secureEqual(secret, env.INTERNAL_SECRET)) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Forbidden"));
        }

        const { grant, email } = req.body;
        const decoded = verifySsoGrant(grant);
        if (typeof email !== "string" || decoded.email !== email.toLowerCase()) {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Grant mismatch"));
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true, name: true, email: true, avatarUrl: true,
                onboarded: true, status: true, twoFactorEnabled: true,
            },
        });
        if (!user || user.status === "SUSPENDED") {
            return res.status(401).json(errorResponse("UNAUTHORIZED", "Invalid session"));
        }

        if (decoded.enrollmentRequired && !user.twoFactorEnabled) {
            return res.status(403).json({
                ...errorResponse(
                    "TWO_FACTOR_SETUP_REQUIRED",
                    "Your organization requires two-factor authentication. Enable it to continue.",
                ),
                requiresTwoFactorSetup: true,
                enrollmentToken: signEnrollmentToken(user.id),
                organizations: [{ id: decoded.organizationId, name: decoded.organizationName }],
            });
        }

        if (await ipBlockedForUser(user.id, clientIpFrom(req))) {
            return res.status(403).json(errorResponse(
                "IP_BLOCKED",
                "Your IP address is not allowed by your organization's security policy. Contact your admin.",
            ));
        }

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id, true);
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } }).catch(() => {});
        const maxAge = await maxSessionAgeForUser(user.id);
        await prisma.userSession
            .create({
                data: {
                    userId: user.id,
                    tokenHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
                    deviceName: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 120) : null,
                    ipAddress: clientIpFrom(req),
                    expiresAt: new Date(Date.now() + (maxAge ?? 30) * 24 * 60 * 60 * 1000),
                },
            })
            .catch((e) => console.warn("session save skipped:", e.message));

        return res.status(200).json(successResponse({ user, accessToken }));
    } catch {
        return res.status(401).json(errorResponse("UNAUTHORIZED", "Grant is invalid or has expired"));
    }
});

export { router as authSsoRouter };

const configRouter = Router();
configRouter.use(authenticate);

configRouter.get("/organizations/:organizationId", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
            select: { id: true },
        });
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));

        const sso = await prisma.organizationSso.findUnique({ where: { organizationId } });
        if (!sso) return res.status(200).json(successResponse({ sso: null }));

        return res.status(200).json(successResponse({
            sso: {
                id: sso.id,
                provider: sso.provider,
                discoveryUrl: sso.discoveryUrl,
                clientId: sso.clientId,
                domain: sso.domain,
                enabled: sso.enabled,
                haveSecret: Boolean(sso.clientSecret),
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch SSO configuration"));
    }
});

configRouter.put("/organizations/:organizationId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "sso");
        if (!entitlements) return;

        const { discoveryUrl, clientId, clientSecret, domain, enabled } = req.body;

        if (typeof discoveryUrl !== "string" || !/^https:\/\//i.test(discoveryUrl)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "discoveryUrl must be a valid https URL"));
        }
        if (typeof clientId !== "string" || !clientId.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "clientId is required"));
        }
        if (typeof domain !== "string" || !domain.includes(".")) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "A valid domain is required"));
        }
        if (clientSecret !== undefined && typeof clientSecret !== "string") {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "clientSecret must be a string"));
        }

        const existing = await prisma.organizationSso.findUnique({ where: { organizationId } });
        const secretToStore = clientSecret ? clientSecret.trim() : existing?.clientSecret;

        if (!secretToStore) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "clientSecret is required on first setup"));
        }

        let sso;
        if (existing) {
            sso = await prisma.organizationSso.update({
                where: { id: existing.id },
                data: {
                    discoveryUrl: discoveryUrl.trim(),
                    clientId: clientId.trim(),
                    ...(secretToStore ? { clientSecret: secretToStore } : {}),
                    domain: domain.trim().toLowerCase(),
                    enabled: enabled !== false,
                },
            });
        } else {
            sso = await prisma.organizationSso.create({
                data: {
                    organizationId,
                    discoveryUrl: discoveryUrl.trim(),
                    clientId: clientId.trim(),
                    clientSecret: secretToStore,
                    domain: domain.trim().toLowerCase(),
                    enabled: enabled !== false,
                },
            });
        }

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "SSO_CONFIG_UPDATED",
            resource: "sso",
            resourceId: sso.id,
            metadata: { provider: sso.provider, domain: sso.domain },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({
            sso: {
                id: sso.id,
                provider: sso.provider,
                discoveryUrl: sso.discoveryUrl,
                clientId: sso.clientId,
                domain: sso.domain,
                enabled: sso.enabled,
                haveSecret: true,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to save SSO configuration"));
    }
});

configRouter.delete("/organizations/:organizationId", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "sso");
        if (!entitlements) return;

        await prisma.organizationSso.deleteMany({ where: { organizationId } });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "SSO_CONFIG_REMOVED",
            resource: "sso",
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ removed: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to remove SSO configuration"));
    }
});

export { configRouter as orgSsoRouter };