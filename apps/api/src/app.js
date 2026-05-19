import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { router } from "./routes/index.js";

const app = express();

// Build allowed origins — normalize to strip trailing slashes
const allowedOrigins = new Set(
    [env.CLIENT_ORIGIN, process.env.ADDITIONAL_ORIGINS]
        .filter(Boolean)
        .flatMap((o) => o.split(","))
        .map((o) => o.trim().replace(/\/$/, ""))
);

const corsOptions = {
    origin(origin, callback) {
        // Allow server-to-server / curl (no origin header)
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, "");
        if (allowedOrigins.has(normalized)) return callback(null, true);
        // Reject without throwing so CORS headers are still sent on the response
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
};

// Handle OPTIONS preflight for every route BEFORE any other middleware
app.options("*", cors(corsOptions));

app.use(cors(corsOptions));

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
