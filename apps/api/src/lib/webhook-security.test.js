import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
    verifySignature256,
    verifySlackSignature,
    verifyFigmaPasscode,
    verifyHmac,
} from "./webhook-security.js";

function ghSignature(secret, body) {
    return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("GitHub signature verifies valid and rejects tampered bodies/secrets", () => {
    const secret = "s3cret-value";
    const body = '{"repository":{"full_name":"acme/one"}}';

    assert.equal(verifySignature256(secret, body, ghSignature(secret, body)), true);
    assert.equal(verifySignature256(secret, body + "x", ghSignature(secret, body)), false);
    assert.equal(verifySignature256("other", body, ghSignature(secret, body)), false);
    assert.equal(verifySignature256(secret, body, "sha256=deadbeef"), false);
    assert.equal(verifySignature256(secret, "", "sha256=0"), false);
    assert.equal(verifySignature256(null, body, "x"), false);
    assert.equal(verifySignature256(secret, body, null), false);
});

test("Slack signed-request validates signature, timestamp window, and format", () => {
    const signingSecret = "slack-signing-secret";
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const body = "payload=%7B%22type%22%3A%22event_callback%22%7D";
    const base = `v0:${timestamp}:${body}`;
    const valid = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;

    assert.equal(verifySlackSignature(signingSecret, body, timestamp, valid, now), true);

    // Replay: timestamp older than the tolerance window.
    const oldTs = String(Math.floor((now - 301_000) / 1000));
    const oldValid = `v0=${crypto.createHmac("sha256", signingSecret).update(`v0:${oldTs}:${body}`).digest("hex")}`;
    assert.equal(verifySlackSignature(signingSecret, body, oldTs, oldValid, now), false);

    // Wrong body → wrong signature.
    const wrongBase = `v0:${timestamp}:${body}%20junk`;
    const wrong = `v0=${crypto.createHmac("sha256", signingSecret).update(wrongBase).digest("hex")}`;
    assert.equal(verifySlackSignature(signingSecret, body, timestamp, wrong, now), false);

    // Junk timestamp / header / missing inputs.
    assert.equal(verifySlackSignature(signingSecret, body, "nope", valid, now), false);
    assert.equal(verifySlackSignature(signingSecret, body, timestamp, "v0=abc", now), false);
    assert.equal(verifySlackSignature(null, body, timestamp, valid, now), false);
    assert.equal(verifySlackSignature(signingSecret, "", timestamp, valid, now), false);
});

test("Figma passcode verification is exact", () => {
    assert.equal(verifyFigmaPasscode("hunter2", "hunter2"), true);
    assert.equal(verifyFigmaPasscode("hunter2", "Hunter2"), false);
    assert.equal(verifyFigmaPasscode("hunter2", ""), false);
    assert.equal(verifyFigmaPasscode(null, "hunter2"), false);
    assert.equal(verifyFigmaPasscode("", "anything"), false);
});

test("generic HMAC verification", () => {
    const secret = "gitlab-secret";
    const body = "{\"object_kind\":\"push\"}";
    const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyHmac(secret, body, hex), true);
    assert.equal(verifyHmac(secret, body, hex.toUpperCase()), false);
    assert.equal(verifyHmac(secret, body, "0".repeat(64)), false);
});