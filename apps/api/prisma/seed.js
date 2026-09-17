import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create demo user
    const passwordHash = await bcrypt.hash("Password123!", 12);
    const user = await prisma.user.upsert({
        where: { email: "demo@flexflow.app" },
        update: {},
        create: {
            name: "Demo User",
            email: "demo@flexflow.app",
            passwordHash,
            onboarded: true,
        },
    });

    console.log(`✅ User: ${user.email}`);

    // ── FREE demo org (baseline experience) ────────────────────────────────
    const org = await prisma.organization.upsert({
        where: { slug: "demo-org" },
        update: {},
        create: {
            name: "Demo Organization",
            slug: "demo-org",
            description: "FlexFlow demo organization",
            plan: "FREE",
            subscriptionStatus: "ACTIVE",
        },
    });

    await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        update: {},
        create: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });

    console.log(`✅ Organization: ${org.name} (FREE)`);

    const workspace = await prisma.workspace.upsert({
        where: { slug: "demo-org-engineering" },
        update: {},
        create: {
            organizationId: org.id,
            name: "Engineering",
            slug: "demo-org-engineering",
            description: "Main engineering workspace",
        },
    });

    await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: {},
        create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });

    console.log(`✅ Workspace: ${workspace.name}`);

    // ── PRO demo org (paid experience source-of-truth) ─────────────────────
    const proOrg = await prisma.organization.upsert({
        where: { slug: "acme-pro" },
        update: {},
        create: {
            name: "Acme Pro",
            slug: "acme-pro",
            description: "Demo organization on the Pro plan",
            plan: "PRO",
            billingCycle: "MONTHLY",
            subscriptionStatus: "ACTIVE",
        },
    });

    const now = new Date();
    const proEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await prisma.organization.update({
        where: { id: proOrg.id },
        data: { subscriptionStartAt: now, subscriptionEndAt: proEnd },
    });

    await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: proOrg.id, userId: user.id } },
        update: {},
        create: { organizationId: proOrg.id, userId: user.id, role: "OWNER" },
    });

    const proWorkspace = await prisma.workspace.upsert({
        where: { slug: "acme-pro-product" },
        update: {},
        create: {
            organizationId: proOrg.id,
            name: "Product",
            slug: "acme-pro-product",
            description: "Pro plan workspace",
        },
    });

    await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: proWorkspace.id, userId: user.id } },
        update: {},
        create: { workspaceId: proWorkspace.id, userId: user.id, role: "OWNER" },
    });

    await prisma.billingEvent.create({
        data: {
            organizationId: proOrg.id,
            provider: "mock",
            eventType: "checkout.completed",
            status: "ACTIVE",
            raw: { planId: "pro", billingCycle: "MONTHLY", seed: true },
        },
    });

    console.log(`✅ Organization: ${proOrg.name} (PRO)`);

    // ── CUSTOM demo org with enterprise add-ons ────────────────────────────
    const customOrg = await prisma.organization.upsert({
        where: { slug: "nebula-custom" },
        update: {},
        create: {
            name: "Nebula Custom",
            slug: "nebula-custom",
            description: "Demo organization on the Custom plan",
            plan: "CUSTOM",
            billingCycle: "ANNUAL",
            subscriptionStatus: "ACTIVE",
            customAddOns: ["sso", "audit_logs", "custom_roles", "dedicated_support"],
        },
    });

    const customEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await prisma.organization.update({
        where: { id: customOrg.id },
        data: { subscriptionStartAt: now, subscriptionEndAt: customEnd },
    });

    await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: customOrg.id, userId: user.id } },
        update: {},
        create: { organizationId: customOrg.id, userId: user.id, role: "OWNER" },
    });

    const customWorkspace = await prisma.workspace.upsert({
        where: { slug: "nebula-custom-platform" },
        update: {},
        create: {
            organizationId: customOrg.id,
            name: "Platform",
            slug: "nebula-custom-platform",
            description: "Custom plan workspace",
        },
    });

    await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: customWorkspace.id, userId: user.id } },
        update: {},
        create: { workspaceId: customWorkspace.id, userId: user.id, role: "OWNER" },
    });

    console.log(`✅ Organization: ${customOrg.name} (CUSTOM + add-ons)`);

    // ── Labels ─────────────────────────────────────────────────────────────
    const labelData = [
        { name: "Bug", color: "#ef4444" },
        { name: "Feature", color: "#6366f1" },
        { name: "Improvement", color: "#10b981" },
        { name: "Documentation", color: "#f59e0b" },
        { name: "Design", color: "#8b5cf6" },
    ];

    const labels = [];
    for (const l of labelData) {
        const label = await prisma.label.upsert({
            where: { id: `label-${l.name.toLowerCase()}-${workspace.id}`.slice(0, 25) },
            update: {},
            create: { workspaceId: workspace.id, name: l.name, color: l.color },
        });
        labels.push(label);
    }

    // ── Projects & tasks ───────────────────────────────────────────────────
    const projectData = [
        { name: "Core Platform", description: "RBAC, authentication, and API foundation.", color: "#6366f1" },
        { name: "Growth", description: "Onboarding flows, invite system, and activation.", color: "#8b5cf6" },
        { name: "Insights", description: "Analytics dashboard, reporting, and exports.", color: "#06b6d4" },
    ];

    for (const pd of projectData) {
        const project = await prisma.project.upsert({
            where: { id: `proj-${pd.name.toLowerCase().replace(/\s/g, "-")}-${workspace.id}`.slice(0, 25) },
            update: {},
            create: { workspaceId: workspace.id, createdById: user.id, ...pd },
        });

        const taskStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
        const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
        const taskTitles = [
            "Set up authentication middleware",
            "Design system tokens",
            "Implement rate limiting",
            "Add error boundary components",
            "Write integration tests",
        ];

        for (let i = 0; i < taskTitles.length; i++) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (i + 1) * 3);

            await prisma.task.create({
                data: {
                    projectId: project.id,
                    createdById: user.id,
                    assigneeId: user.id,
                    title: taskTitles[i],
                    description: `<p>Task: ${taskTitles[i]} for ${project.name}.</p>`,
                    status: taskStatuses[i % taskStatuses.length],
                    priority: priorities[i % priorities.length],
                    dueDate,
                },
            });
        }

        await prisma.activityLog.create({
            data: {
                userId: user.id,
                projectId: project.id,
                action: "created project",
                entityType: "project",
                entityId: project.id,
            },
        });

        console.log(`✅ Project: ${project.name} (5 tasks)`);
    }

    // Decision memory is intentionally NOT seeded with canned answers — Team
    // Intelligence must answer from real workspace work (tasks, activity,
    // members) and any knowledge a user records themselves.

    // ── Audit events & usage snapshot ──────────────────────────────────────
    await prisma.auditEvent.createMany({
        data: [
            {
                actorId: user.id,
                action: "billing.checkout_confirmed",
                resource: "billing",
                metadata: { planId: "pro", seed: true },
                organizationId: proOrg.id,
            },
            {
                actorId: user.id,
                action: "settings.roles_updated",
                resource: "roles",
                metadata: { matrix: "Admin" },
                organizationId: customOrg.id,
            },
            {
                actorId: user.id,
                action: "intelligence.query",
                resource: "intelligence",
                metadata: { query: "launch freeze", sample: true },
                organizationId: customOrg.id,
            },
        ],
        skipDuplicates: true,
    });

    await prisma.apiUsage.upsert({
        where: { organizationId_month: { organizationId: proOrg.id, month: new Date().toISOString().slice(0, 7) } },
        update: {},
        create: { organizationId: proOrg.id, month: new Date().toISOString().slice(0, 7), requestCount: 1240 },
    });

    await prisma.intelligenceUsage.upsert({
        where: { organizationId_day: { organizationId: proOrg.id, day: new Date().toISOString().slice(0, 10) } },
        update: {},
        create: { organizationId: proOrg.id, day: new Date().toISOString().slice(0, 10), queryCount: 7 },
    });

    console.log("✅ Audit + usage records");

    console.log("\n🎉 Seed complete!");
    console.log("──────────────────────────────");
    console.log("Login:    demo@flexflow.app");
    console.log("Password: Password123!");
    console.log("  • demo-org      → Free plan");
    console.log("  • acme-pro      → Pro plan (active subscription)");
    console.log("  • nebula-custom → Custom plan + enterprise add-ons");
    console.log("──────────────────────────────");
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());