import crypto from "crypto";
import { createRequire } from "module";
import bcrypt from "bcryptjs";

import { encryptSecret, decryptSecret } from "./crypto.js";

// otplib v13 exposes a functional API (generateSecret, generateURI, verifySync).
// Load via CJS for stable interop across runtimes.
const require = createRequire(import.meta.url);
const { generateSecret, generateURI, verifySync } = require("otplib");

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_ROUNDS = 10;

/** Generate a base32 TOTP secret (20 bytes / 160 bits by default). */
export function createTotpSecret() {
    return generateSecret();
}

/** Encrypt a TOTP secret for storage at rest. */
export function storeTotpSecret(secret) {
    return encryptSecret(secret);
}

/**
 * Read a stored TOTP secret. Handles both encrypted values (new) and legacy
 * plaintext base32 secrets so existing enrolments keep working.
 */
export function readTotpSecret(stored) {
    if (!stored) return null;
    const decrypted = decryptSecret(stored);
    return decrypted || stored;
}

/** Build the otpauth:// URI an authenticator app scans. */
export function otpAuthUri(email, secret) {
    return generateURI({ issuer: "FlexFlow", label: email, secret });
}

/**
 * Verify a 6-digit TOTP token against a secret. Allows a ±1 step window to
 * tolerate small clock skew. Never throws — returns a boolean.
 */
export function verifyTotp(secret, token) {
    if (!secret || !token) return false;
    const code = String(token).replace(/\s+/g, "");
    try {
        const result = verifySync({ token: code, secret, window: 1 });
        return Boolean(result && (result.valid ?? result === true));
    } catch {
        return false;
    }
}

/** Fresh set of human-transcribable recovery codes, e.g. "a1b2c-3d4e5". */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
    const codes = [];
    while (codes.length < count) {
        const raw = crypto.randomBytes(5).toString("hex"); // 10 chars
        const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
        if (!codes.includes(code)) codes.push(code);
    }
    return codes;
}

/** Hash a recovery code with bcrypt before it ever touches the database. */
export function hashRecoveryCode(code) {
    return bcrypt.hash(normalizeRecoveryCode(code), RECOVERY_CODE_ROUNDS);
}

function normalizeRecoveryCode(code) {
    return String(code || "").trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
}

/**
 * Constant-ish time recovery-code check across a set of stored hashes.
 * Returns the matching stored row's id (so the caller can mark it used)
 * or null.
 */
export async function matchRecoveryCode(candidate, storedCodes = []) {
    const normalized = normalizeRecoveryCode(candidate);
    if (normalized.length !== 10) return null;
    let matched = null;
    for (const entry of storedCodes) {
        if (entry.usedAt) continue;
        // Compare every candidate to avoid early-exit timing leaks.
        const ok = await bcrypt.compare(normalized, entry.hashedCode).catch(() => false);
        if (ok && !matched) matched = entry.id;
    }
    return matched;
}
