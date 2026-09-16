import crypto from "node:crypto";

/**
 * Timing-safe string comparison. Returns false for length mismatches.
 */
export function secureEqual(a, b) {
    const aBuf = Buffer.from(String(a ?? ""));
    const bBuf = Buffer.from(String(b ?? ""));

    if (aBuf.length !== bBuf.length) return false;
    if (aBuf.length === 0) return true;

    return crypto.timingSafeEqual(aBuf, bBuf);
}