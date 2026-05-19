import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { router } from "./routes/index.js";

const app = express();

// Build allowed origins list from env
const allowedOrigins = new Set([env.CLIENT_ORIGIN]);
if (process.env.ADDITIONAL_ORIGINS) {
    process.env.ADDITIONAL_ORIGINS.split(",").forEach((o) => allowedOrigins.add(o.trim()));
}

app.use(
    pinoHttp({
        transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
        autoLogging: env.NODE_ENV === "development",
    }),
);

app.use(
    cors({
        origin(origin, callback) {
            // Allow requests with no origin (mobile apps, curl, server-to-server)
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true);
            }
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(helmet({ crossOriginResourcePolicy: false }));

if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => res.json({ status: "ok", service: "flexflow-api" }));

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
