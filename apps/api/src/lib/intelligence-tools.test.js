import { test } from "node:test";
import assert from "node:assert/strict";

import {
    monthRange,
    previousMonthRange,
    weekRange,
    previousWeekRange,
    pctChange,
    countCreated,
    countCompleted,
    classifyIntent,
    blockedTasks,
    overdueTasks,
    atRiskProjects,
    workloadStats,
    productivityMetrics,
    orgMemoryRange,
    isolateCorpusToWorkspace,
} from "./intelligence-tools.js";

test("period math is exact UTC with no drift", () => {
    const at = new Date("2025-01-15T00:00:00Z");
    const m = monthRange(at);
    assert.equal(m.start.toISOString(), "2025-01-01T00:00:00.000Z");
    assert.equal(m.end.toISOString(), "2025-02-01T00:00:00.000Z");
    const pm = previousMonthRange(at);
    assert.equal(pm.start.toISOString(), "2024-12-01T00:00:00.000Z");
    assert.equal(pm.end.toISOString(), "2025-01-01T00:00:00.000Z");
    const w = weekRange(at);
    assert.equal(w.start.getUTCDay(), 1);
    assert.equal(w.end.getTime() - w.start.getTime(), 7 * 86400000);
});

test("pctChange is zero-division safe and sign-correct", () => {
    assert.equal(pctChange(30, 15), 100);
    assert.equal(pctChange(10, 20), -50);
    assert.equal(pctChange(0, 0), null);
    assert.equal(pctChange(5, 0), null);
});

test("intent classifier routes deterministically", () => {
    assert.equal(classifyIntent("Which tasks are blocked?"), "blocked");
    assert.equal(classifyIntent("Who has too much on their plate?"), "workload");
    assert.equal(classifyIntent("Compare this month with last"), "compare");
    assert.equal(classifyIntent("Anything overdue?"), "overdue");
    assert.equal(classifyIntent("Tell me about pizza"), "general");
});

test("blockedTasks counts per project without fabricating", () => {
    const tasks = [
        { id: "a", projectId: "p1", status: "BLOCKED" },
        { id: "b", projectId: "p1", status: "IN_PROGRESS" },
    ];
    const r = blockedTasks(tasks);
    assert.equal(r.total, 1);
    assert.deepEqual(r.ids, ["a"]);
});

test("workloadStats ignores tasks with no assignee", () => {
    const tasks = [{ id: "a", status: "TODO", assigneeId: null }];
    const r = workloadStats(tasks, {});
    assert.deepEqual(r.byUser, []);
    assert.equal(r.busiest, null);
});


test("orgMemoryRange starts at the literal org creation day", () => {

    const orgCreated = new Date("2025-01-10T00:00:00.000Z");

    const at = new Date("2026-02-14T00:00:00.000Z");

    const r = orgMemoryRange(orgCreated, at);

    assert.equal(r.start.toISOString(), "2025-01-10T00:00:00.000Z");

    assert.equal(r.end.toISOString(), "2026-02-14T00:00:00.000Z");

});


test("orgMemoryRange keeps full history — no one-year cap for older orgs", () => {

    const orgCreated = new Date("2022-01-01T00:00:00.000Z");

    const at = new Date("2026-02-14T00:00:00.000Z");

    const r = orgMemoryRange(orgCreated, at);

    assert.equal(r.start.toISOString(), "2022-01-01T00:00:00.000Z");

    assert.equal(r.end.toISOString(), "2026-02-14T00:00:00.000Z");

});

test("countCompleted uses DONE status + completedAt window", () => {
    const week = weekRange(new Date("2025-01-15T00:00:00Z"));
    const tasks = [
        { id: "a", status: "DONE", completedAt: new Date("2025-01-14T00:00:00Z") },
        { id: "b", status: "DONE", completedAt: new Date("2025-01-15T00:00:00Z") },
        { id: "c", status: "IN_PROGRESS", completedAt: new Date("2025-01-15T00:00:00Z") },
        { id: "d", status: "DONE", completedAt: new Date("2024-12-01T00:00:00Z") },
    ];
    assert.equal(countCompleted(tasks, week), 2);
});

test("productivityMetrics maps schema statuses (DONE/BLOCKED)", () => {
    const tasks = [
        { id: "a", status: "DONE" },
        { id: "b", status: "DONE" },
        { id: "c", status: "BLOCKED" },
        { id: "d", status: "TODO" },
    ];
    const m = productivityMetrics(tasks);
    assert.equal(m.total, 4);
    assert.equal(m.completed, 2);
    assert.equal(m.blocked, 1);
    assert.equal(m.completionRate, 50);
    assert.equal(m.blockedRate, 25);
});


test("isolateCorpusToWorkspace drops other-workspace detail", () => {

    const corpus = [

        { sourceType: "task", workspaceId: "ws-a", sourceId: "t1", title: "A" },

        { sourceType: "task", workspaceId: "ws-b", sourceId: "t2", title: "B secret" },

        { sourceType: "comment", workspaceId: "ws-b", sourceId: "c1", title: "C secret" },

    ];

    const scoped = isolateCorpusToWorkspace(corpus, { activeWorkspaceId: "ws-a", canSeeAll: false });

    assert.equal(scoped.length, 1);

    assert.equal(scoped[0].sourceId, "t1");

});


test("org admin keeps only org-shared items outside the workspace", () => {

    const corpus = [

        { sourceType: "knowledge", workspaceId: null, sourceId: "k1", title: "org knowledge" },

        { sourceType: "task", workspaceId: "ws-b", sourceId: "t2", title: "B" },

    ];

    const scoped = isolateCorpusToWorkspace(corpus, { activeWorkspaceId: "ws-a", canSeeAll: true });

    assert.deepEqual(scoped.map((i) => i.sourceId), ["k1"]);

});
