import { createServer } from "node:http";

import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { setIO } from "./lib/realtime.js";

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

        socket.on("project:join", (projectId) => {
            socket.join(projectId);
        });

        socket.on("project:leave", (projectId) => {
            socket.leave(projectId);
        });
    });

    httpServer.listen(env.PORT, () => {
        console.log(`FlexFlow API running on http://localhost:${env.PORT}`);
    });
}

bootstrap();
