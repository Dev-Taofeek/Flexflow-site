import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { enforceFeature } from "../lib/entitlements.js";
import { requireOrgRole } from "../lib/permissions.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { clientIpFrom, recordAudit } from "../lib/audit.js";
import { listUserSessions } from "../lib/sessions.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

const IP_ENTRY_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

function sanitizeIpAllowlist(entries) {
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const cleaned = [];
    for (const entry of entries) {
        const value = String(entry || "").trim();
        if (!IP_ENTRY_RE.test(value)) continue;
        const dedupe = value.toLowerCase();
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        cleaned.push(value);
    }
    return cleaned;
}

function currentUserAgent(req) {
    return typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 120) : null;
}

router.get("/organizations/:organizationId/policy", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
            select: { id: true },
        });
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));
        const entitlements = await enforceFeature(req, res, organizationId, "advanced_security");
        if (!entitlements) return;

        const policy = await prisma.orgSecurityPolicy.findUnique({ where: { organizationId } });
        return res.status(200).json(successResponse({
            policy: policy
                ? {
                      ipAllowlistEnabled: policy.ipAllowlistEnabled,
                      ipAllowlist: policy.ipAllowlist,
                      sessionMaxAgeDays: policy.sessionMaxAgeDays,
                      passwordMinLength: policy.passwordMinLength,
                  }
                : null,
            currentIp: clientIpFrom(req),
            requireTwoFactor: (await prisma.organization.findUnique({ where: { id: organizationId }, select: { requireTwoFactor: true } }))?.requireTwoFactor || false,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch security policy"));
    }
});

router.put("/organizations/:organizationId/policy", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId } = req.params;
        const entitlements = await enforceFeature(req, res, organizationId, "advanced_security");
        if (!entitlements) return;

        const { ipAllowlistEnabled, ipAllowlist, sessionMaxAgeDays, passwordMinLength } = req.body;

        const maxAge = Number(sessionMaxAgeDays);
        if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > 365) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "sessionMaxAgeDays must be between 1 and 365"));
        }
        if (ipAllowlistEnabled && (!Array.isArray(ipAllowlist) || ipAllowlist.length === 0)) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "At least one CIDR entry is required when the IP allow-list is enabled"));
        }
        const minLength = Number(passwordMinLength);
        if (!Number.isInteger(minLength) || minLength < 8 || minLength > 64) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "passwordMinLength must be between 8 and 64"));
        }

        const cleaned = sanitizeIpAllowlist(ipAllowlist);
        if (ipAllowlistEnabled && cleaned.length === 0) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "IP allow-list entries are invalid"));
        }

        const data = {
            ipAllowlistEnabled: Boolean(ipAllowlistEnabled),
            ipAllowlist: ipAllowlistEnabled ? cleaned : [],
            sessionMaxAgeDays: maxAge,
            passwordMinLength: minLength,
        };

        const policy = await prisma.orgSecurityPolicy.upsert({
            where: { organizationId },
            create: { organizationId, ...data },
            update: data,
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "SECURITY_POLICY_UPDATED",
            resource: "security-policy",
            resourceId: policy.id,
            metadata: {
                ipAllowlistEnabled: policy.ipAllowlistEnabled,
                sessionMaxAgeDays: policy.sessionMaxAgeDays,
                passwordMinLength: policy.passwordMinLength,
            },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({
            policy: {
                ipAllowlistEnabled: policy.ipAllowlistEnabled,
                ipAllowlist: policy.ipAllowlist,
                sessionMaxAgeDays: policy.sessionMaxAgeDays,
                passwordMinLength: policy.passwordMinLength,
            },
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to save security policy"));
    }
});

router.get("/organizations/:organizationId/sessions", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
            select: { id: true },
        });
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));
        const entitlements = await enforceFeature(req, res, organizationId, "advanced_security");
        if (!entitlements) return;

        const ip = clientIpFrom(req);
        const ua = currentUserAgent(req);
        const sessions = await listUserSessions(req.user.id);
        const enriched = sessions.map((s) => ({
            ...s,
            current: s.ipAddress === ip && Boolean(ua) && s.deviceName === ua,
        }));

        return res.status(200).json(successResponse({ sessions: enriched, currentIp: ip }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch sessions"));
    }
});

router.post("/organizations/:organizationId/sessions/logout-all", async (req, res) => {
    try {
        const { organizationId } = req.params;
        const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
            select: { id: true },
        });
        if (!membership) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member of this organization"));
        const entitlements = await enforceFeature(req, res, organizationId, "advanced_security");
        if (!entitlements) return;

        await prisma.$transaction([
            prisma.userSession.deleteMany({ where: { userId: req.user.id } }),
            prisma.user.update({ where: { id: req.user.id }, data: { refreshToken: null } }),
        ]);

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "ALL_SESSIONS_REVOKED",
            resource: "user-sessions",
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({ loggedOut: true }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to sign out all sessions"));
    }
});

export { router as securityRouter };