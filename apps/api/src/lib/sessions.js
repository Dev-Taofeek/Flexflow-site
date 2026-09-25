import crypto from "crypto";

import { prisma } from "./prisma.js";

// Sessions are trackable refresh-token holders. We only ever store the SHA-256
// of the refresh token so a leaked DB never exposes usable tokens.
export function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomSessionToken() {
    return crypto.randomBytes(48).toString("hex");
}

export async function createSession({ userId, token, remember = false, deviceName, ipAddress, sessionMaxAgeDays }) {
    const maxAgeDays = Math.max(1, sessionMaxAgeDays ?? (remember ? 30 : 1));
    const expiresAt = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000);
    await prisma.userSession.create({
        data: {
            userId,
            tokenHash: hashSessionToken(token),
            deviceName: deviceName ? String(deviceName).slice(0, 120) : null,
            ipAddress: ipAddress || null,
            expiresAt,
        },
        select: { id: true },
    });
    return expiresAt;
}

// Strictest policy wins when a user spans several workspaces: the shortest
// session lifetime and, if ANY org enforces an allow-list, the IP must be
// allowed by at least one of them.
export async function maxSessionAgeForUser(userId) {
    const policies = await prisma.orgSecurityPolicy.findMany({
        where: { organization: { members: { some: { userId } } } },
        select: { sessionMaxAgeDays: true },
    });
    if (policies.length === 0) return null;
    return Math.max(1, Math.min(...policies.map((p) => p.sessionMaxAgeDays || 30)));
}

// Strictest password length across the user's orgs (they must satisfy every
// team's policy).
export async function passwordMinLengthForUser(userId) {
    const policies = await prisma.orgSecurityPolicy.findMany({
        where: { organization: { members: { some: { userId } } } },
        select: { passwordMinLength: true },
    });
    if (policies.length === 0) return 8;
    return Math.min(64, Math.max(8, ...policies.map((p) => p.passwordMinLength || 8)));
}

export async function ipBlockedForUser(userId, ip) {
    if (!ip) return false;
    const enforcing = await prisma.orgSecurityPolicy.findMany({
        where: {
            organization: { members: { some: { userId } } },
            ipAllowlistEnabled: true,
        },
        select: { ipAllowlist: true },
    });
    if (enforcing.length === 0) return false;
    return !enforcing.some((p) => isIpAllowed(p.ipAllowlist, ip));
}

function ipToLong(ip) {
    return ip
        .split(".")
        .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

export function isIpAllowed(entries, ip) {
    if (!Array.isArray(entries) || entries.length === 0) return false;
    if (!ip) return false;
    const target = ipToLong(ip);
    if (Number.isNaN(target)) return false;

    return entries.some((entry) => {
        const trimmed = String(entry || "").trim();
        if (!trimmed) return false;

        const [rangeIp, rawPrefix] = trimmed.split("/");
        const prefix = rawPrefix === undefined ? 32 : Number(rawPrefix);
        if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

        const network = ipToLong(rangeIp);
        if (Number.isNaN(network)) return false;

        const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
        return (target & mask) === (network & mask);
    });
}

export async function findSessionByToken(token) {
    return prisma.userSession.findFirst({ where: { tokenHash: hashSessionToken(token) } });
}

export async function revokeSession(token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

// Adopt a pre-existing refresh token into a session row so legacy users get
// session visibility without being logged out.
export async function ensureSessionForToken({ token, userId, remember, deviceName, ipAddress }) {
    const existing = await findSessionByToken(token);
    if (existing) return existing;
    await createSession({ userId, token, remember, deviceName, ipAddress });
    return prisma.userSession.findFirst({ where: { tokenHash: hashSessionToken(token) } });
}

export async function listUserSessions(userId) {
    return prisma.userSession.findMany({
        where: { userId },
        orderBy: { lastUsedAt: "desc" },
        select: {
            id: true,
            deviceName: true,
            ipAddress: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
        },
    });
}

export async function touchSession(sessionId) {
    await prisma.userSession
        .update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
}

export async function purgeExpiredSessions() {
    await prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}