import { createServer } from "node:http";

import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { setIO } from "./lib/realtime.js";
import { prisma } from "./lib/prisma.js";
import { processExpiringSubscriptions } from "./services/billing.service.js";

async function bootstrap() {
    const httpServer = createServer(app);

    const io = new Server(httpServer, {
        cors: {
            origin: env.CLIENT_ORIGIN,
            credentials: true,
        },
    });

    app.set("io", io);
    setIO(io);

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Authentication required"));

            const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        if (socket.userId) {
            socket.join(socket.userId);
        }

        socket.on("project:join", async (projectId) => {
            if (typeof projectId !== "string" || !projectId) return;
            try {
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { workspaceId: true, workspace: { select: { organizationId: true } } },
                });
                if (!project) return;

                const workspaceMember = await prisma.workspaceMember.findUnique({
                    where: { workspaceId_userId: { userId: socket.userId, workspaceId: project.workspaceId } },
                    select: { id: true },
                });
                const orgMember = workspaceMember
                    ? null
                    : await prisma.organizationMember.findFirst({
                          where: { organizationId: project.workspace.organizationId, userId: socket.userId, role: { in: ["OWNER", "ADMIN"] } },
                          select: { id: true },
                      });

                if (workspaceMember || orgMember) {
                    socket.join(`project:${projectId}`);
                    socket.emit("project:joined", { projectId });
                } else {
                    socket.emit("project:join:error", { message: "Could not verify project access" });
                }
            } catch (error) {
                socket.emit("project:join:error", { message: "Could not verify project access" });
            }
        });

        socket.on("project:leave", (projectId) => {
            socket.leave(`project:${projectId}`);
        });
    });

    httpServer.listen(env.PORT, () => {
        console.log(`FlexFlow API running on http://localhost:${env.PORT}`);
    });

    // Billing lifecycle sweep — runs on boot and every 6 hours. Idempotent by
    // construction (see processExpiringSubscriptions) so overlapping runs are
    // harmless.
    const runBillingSweep = () =>
        processExpiringSubscriptions().catch((error) =>
            console.error("Billing subscription sweep failed:", error.message || error),
        );
    void runBillingSweep();
    setInterval(runBillingSweep, 6 * 60 * 60 * 1000).unref();
}

bootstrap();
