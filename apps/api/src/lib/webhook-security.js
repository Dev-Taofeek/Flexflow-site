import crypto from "node:crypto";

import { secureEqual } from "./secure-compare.js";

/** GitHub-style HMAC-SHA256 signature (`sha256=<hex>`) over the raw body. */
export function verifySignature256(secret, rawBody, signatureHeader) {
    if (!secret || !rawBody || !signatureHeader) return false;
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const actual = String(signatureHeader).trim();
    return secureEqual(expected, actual);
}

/**
 * Slack signed-request verification (v0). `signatureHeader` looks like
 * `v0=hex`. Also checks the timestamp is within `toleranceSec` of now to
 * defeat replay attacks.
 */
export function verifySlackSignature(signingSecret, rawBody, timestamp, signatureHeader, now = Date.now(), toleranceSec = 300) {
    if (!signingSecret || !rawBody || !timestamp || !signatureHeader) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(now - ts * 1000) > toleranceSec * 1000) return false;

    const base = `v0:${timestamp}:${rawBody}`;
    const expected = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;
    const actual = String(signatureHeader).trim();

    return secureEqual(expected, actual);
}

/**
 * Figma webhooks carry a `passcode` query parameter that the owner configured
 * when registering the webhook in Figma. Verification is a constant-time
 * comparison against the stored passcode.
 */
export function verifyFigmaPasscode(storedPasscode, providedPasscode) {
    if (!storedPasscode || !providedPasscode) return false;
    return secureEqual(String(storedPasscode), String(providedPasscode));
}

/**
 * Flat exact-match compare for generic provider HMACs (e.g. GitLab-style
 * `X-Hub-Signature`). Kept generic so new providers reuse one code path.
 */
export function verifyHmac(secret, rawBody, signatureHeader, algorithm = "sha256") {
    if (!secret || !rawBody || !signatureHeader) return false;
    const expected = crypto.createHmac(algorithm, secret).update(rawBody).digest("hex");
    return secureEqual(expected, String(signatureHeader).trim());
}