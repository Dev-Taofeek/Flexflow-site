import Redis from "ioredis";

let redis = null;

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
    });

    redis.on("error", (err) => {
        if (process.env.NODE_ENV !== "production") {
            console.warn("Redis connection error:", err.message);
        }
    });
}

export { redis };
