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

    // Create organization
    const org = await prisma.organization.upsert({
        where: { slug: "demo-org" },
        update: {},
        create: {
            name: "Demo Organization",
            slug: "demo-org",
            description: "FlexFlow demo organization",
        },
    });

    // Add owner membership
    await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        update: {},
        create: { organizationId: org.id, userId: user.id, role: "OWNER" },
    });

    console.log(`✅ Organization: ${org.name}`);

    // Create workspace
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

    // Add workspace member
    await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: {},
        create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });

    console.log(`✅ Workspace: ${workspace.name}`);

    // Create labels
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

    // Create projects
    const projectData = [
        { name: "Core Platform", description: "RBAC, authentication, and API foundation.", color: "#6366f1" },
        { name: "Growth", description: "Onboarding flows, invite system, and activation.", color: "#8b5cf6" },
        { name: "Insights", description: "Analytics dashboard, reporting, and exports.", color: "#06b6d4" },
    ];

    for (const pd of projectData) {
        const project = await prisma.project.upsert({
            where: { id: `proj-${pd.name.toLowerCase().replace(/\s/g,"-")}-${workspace.id}`.slice(0, 25) },
            update: {},
            create: { workspaceId: workspace.id, createdById: user.id, ...pd },
        });

        // Create issues for each project
        const issueStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
        const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
        const issueTitles = [
            "Set up authentication middleware",
            "Design system tokens",
            "Implement rate limiting",
            "Add error boundary components",
            "Write integration tests",
        ];

        for (let i = 0; i < issueTitles.length; i++) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (i + 1) * 3);

            await prisma.issue.create({
                data: {
                    projectId: project.id,
                    createdById: user.id,
                    assigneeId: user.id,
                    title: issueTitles[i],
                    description: `<p>Task: ${issueTitles[i]} for ${project.name}.</p>`,
                    status: issueStatuses[i % issueStatuses.length],
                    priority: priorities[i % priorities.length],
                    dueDate,
                },
            });
        }

        // Log activity
        await prisma.activityLog.create({
            data: {
                userId: user.id,
                projectId: project.id,
                action: "created project",
                entityType: "project",
                entityId: project.id,
            },
        });

        console.log(`✅ Project: ${project.name} (5 issues)`);
    }

    console.log("\n🎉 Seed complete!");
    console.log("──────────────────────────────");
    console.log("Login:    demo@flexflow.app");
    console.log("Password: Password123!");
    console.log("──────────────────────────────");
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
