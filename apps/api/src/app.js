import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { router } from "./routes/index.js";

const app = express();

// Build allowed origins list
const allowedOrigins = [
    env.CLIENT_ORIGIN,
    ...(process.env.ADDITIONAL_ORIGINS
        ? process.env.ADDITIONAL_ORIGINS.split(",").map((o) => o.trim())
        : []),
].map((o) => o.replace(/\/$/, "").toLowerCase());

// Manual CORS middleware — runs before everything else
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const normalized = origin ? origin.replace(/\/$/, "").toLowerCase() : "";

    if (!origin || allowedOrigins.includes(normalized)) {
        if (origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Vary", "Origin");
        }
    }

    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

    // Respond immediately to preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    next();
});

app.use(
    pinoHttp({
        transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
        autoLogging: env.NODE_ENV === "development",
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
