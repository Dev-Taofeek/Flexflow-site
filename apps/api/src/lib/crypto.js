import crypto from "crypto";

import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";

function key() {
    return crypto.createHash("sha256").update(env.INTERNAL_SECRET).digest();
}

export function encryptSecret(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(ciphertext) {
    if (!ciphertext) return null;
    const [ivStr, tagStr, dataStr] = String(ciphertext).split(".");
    if (!ivStr || !tagStr || !dataStr) return null;
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivStr, "base64"));
        decipher.setAuthTag(Buffer.from(tagStr, "base64"));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(dataStr, "base64")), decipher.final()]);
        return decrypted.toString("utf8");
    } catch {
        return null;
    }
}