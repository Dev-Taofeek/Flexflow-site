import { createServer } from "node:http";

import { Server } from "socket.io";

import { app } from "./app.js";
import { env } from "./config/env.js";

async function bootstrap() {
    const httpServer = createServer(app);

    const io = new Server(httpServer, {
        cors: {
            origin: env.CLIENT_ORIGIN,
            credentials: true,
        },
    });

    app.set("io", io);

    io.on("connection", (socket) => {
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
