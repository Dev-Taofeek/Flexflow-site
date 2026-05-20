import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { router } from "./routes/index.js";

const app = express();

// Allowed origins — always includes CLIENT_ORIGIN + localhost for dev
const rawOrigins = [
    env.CLIENT_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.ADDITIONAL_ORIGINS
        ? process.env.ADDITIONAL_ORIGINS.split(",").map((o) => o.trim())
        : []),
].map((o) => o.replace(/\/$/, "").toLowerCase());

console.log("[CORS] Allowed origins:", rawOrigins);

// CORS — must be the very first middleware
app.use((req, res, next) => {
    const origin = req.headers.origin || "";
    const normalized = origin.replace(/\/$/, "").toLowerCase();

    console.log(`[CORS] ${req.method} ${req.path} — origin: "${origin}"`);

    // Always set these headers
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Accept");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (!origin || rawOrigins.includes(normalized)) {
        if (origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Vary", "Origin");
        }
    } else {
        console.warn(`[CORS] Blocked origin: "${origin}"`);
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(
    pinoHttp({
        transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
        autoLogging: false,
    }),
);

app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => res.json({ status: "ok", service: "flexflow-api", allowedOrigins: rawOrigins }));

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
