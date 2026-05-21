import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
    const { q, workspaceId } = req.query;

    if (!q || q.trim().length < 2) {
        return res.status(200).json(successResponse({ issues: [], projects: [], members: [] }));
    }

    const query = q.trim();

    try {
        // Get org IDs the user belongs to for member search scoping
        const memberships = await prisma.organizationMember.findMany({
            where: { userId: req.user.id },
            select: { organizationId: true },
        });
        const orgIds = memberships.map((m) => m.organizationId);

        const [issues, projects, members] = await Promise.all([
            workspaceId
                ? prisma.issue.findMany({
                      where: {
                          project: { workspaceId },
                          OR: [
                              { title: { contains: query, mode: "insensitive" } },
                              { description: { contains: query, mode: "insensitive" } },
                          ],
                      },
                      include: {
                          project: { select: { id: true, name: true } },
                          assignee: { select: { id: true, name: true, avatarUrl: true } },
                      },
                      take: 8,
                  })
                : Promise.resolve([]),

            workspaceId
                ? prisma.project.findMany({
                      where: {
                          workspaceId,
                          name: { contains: query, mode: "insensitive" },
                      },
                      take: 5,
                  })
                : Promise.resolve([]),

            prisma.user.findMany({
                where: {
                    name: { contains: query, mode: "insensitive" },
                    organizations: {
                        some: { organizationId: { in: orgIds } },
                    },
                },
                select: { id: true, name: true, email: true, avatarUrl: true },
                take: 5,
            }),
        ]);

        return res.status(200).json(successResponse({ issues, projects, members }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Search failed"));
    }
});

export { router as searchRouter };
