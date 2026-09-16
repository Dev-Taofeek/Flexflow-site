import { test } from "node:test";
import assert from "node:assert/strict";

import {
    keyPrefixFor,
    formatTaskKey,
    extractTaskKeys,
} from "./task-key.js";

test("keyPrefixFor collapses slugs to uppercase alphanumeric prefixes", () => {
    assert.equal(keyPrefixFor("my-super-workspace"), "MYSUP");
    assert.equal(keyPrefixFor("acme 42"), "ACME4");
    assert.equal(keyPrefixFor("lowercase"), "LOWER");
    assert.equal(keyPrefixFor("MAILING"), "MAILI");
    assert.equal(keyPrefixFor(""), "FLEX");
    assert.equal(keyPrefixFor("!!!$$$"), "FLEX");
    assert.equal(keyPrefixFor(null), "FLEX");
    assert.equal(keyPrefixFor(undefined), "FLEX");
});

test("formatTaskKey normalizes prefix and embeds the number", () => {
    assert.equal(formatTaskKey("flex", 7), "FLEX-7");
    assert.equal(formatTaskKey("TEAM", 42), "TEAM-42");
    assert.equal(formatTaskKey(undefined, 1), "FLEX-1");
});

test("extractTaskKeys finds keys in free-form text deterministically", () => {
    assert.deepEqual(
        extractTaskKeys("Fix FLEX-184 and mention TEAM-42, done in branch flex-9."),
        ["FLEX-184", "TEAM-42", "FLEX-9"],
    );
    assert.deepEqual(extractTaskKeys("only digits FLEX-0", 0), ["FLEX-0"]);
    assert.deepEqual(extractTaskKeys("no keys here -> 12345"), []);
    assert.deepEqual(extractTaskKeys(""), []);
    assert.deepEqual(extractTaskKeys(null), []);
});

test("extractTaskKeys dedupes repeated references and applies minSegment", () => {
    assert.deepEqual(extractTaskKeys("FLEX-1 FLEX-1 flex-1"), ["FLEX-1"]);
    assert.deepEqual(
        extractTaskKeys("FLEX-1 TEAM-100", 2),
        ["TEAM-100"],
    );
});