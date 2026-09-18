import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    INTERNAL_SECRET: z.string().min(32, "INTERNAL_SECRET must be at least 32 characters"),
    CLIENT_ORIGIN: z.string().url("CLIENT_ORIGIN must be a valid URL"),
    EMAILJS_SERVICE_ID: z.string().optional(),
    EMAILJS_TEMPLATE_ID: z.string().optional(),
    EMAILJS_PUBLIC_KEY: z.string().optional(),
    EMAILJS_PRIVATE_KEY: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    // When "true", enables POST /auth/demo-credentials for the marketing site.
    DEMO_MODE: z.string().optional(),
    // ── Team Intelligence LLM synthesis (optional — deterministic fallback) ───
    // When set, Groq may only REPHRASE deterministic backend answers. Numbers,
    // percentages, and citations stay backend-computed; without the key the
    // service answers deterministically (never fabricated AI).
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().optional(),
    GROQ_API_BASE: z.string().url().optional(),

    // ── Paystack ──────────────────────────────────────────────────────────────
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),
    PAYSTACK_WEBHOOK_SECRET: z.string().optional(),

    // ── Integrations (optional) ───────────────────────────────────────────────
    // Connector secrets are stored per-connection in the DB; these optionally
    // seed defaults for outbound API calls made server-side.
    GH_APP_WEBHOOK_SECRET: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    FIGMA_WEBHOOK_PASSCODE: z.string().optional(),

    // ── Integration OAuth apps (optional) ─────────────────────────────────────
    // When a provider's client id/secret are present, the guided Integrations
    // UI additionally offers a one-click OAuth connect flow.
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    FIGMA_CLIENT_ID: z.string().optional(),
    FIGMA_CLIENT_SECRET: z.string().optional(),
    // Public base URL of this API, used to build OAuth redirect URIs.
    API_PUBLIC_URL: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("Invalid environment variables", parsedEnv.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsedEnv.data;
