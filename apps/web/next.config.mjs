/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "avatars.githubusercontent.com" },
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
            { protocol: "https", hostname: "*.cloudinary.com" },
            { protocol: "https", hostname: "*.supabase.co" },
            { protocol: "https", hostname: "secure.gravatar.com" },
            { protocol: "https", hostname: "avatars.slack-edge.com" },
        ],
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                ],
            },
            {
                source: "/api/:path*",
                headers: [{ key: "Cache-Control", value: "no-store" }],
            },
        ];
    },
    experimental: {
        serverActions: {
            allowedOrigins: [
                "localhost:3000",
                "flexflow-one.vercel.app",
            ],
        },
    },
    async redirects() {
        return [
            { source: "/issues", destination: "/tasks", permanent: true },
            { source: "/projects/:projectId/issues/:taskId", destination: "/projects/:projectId/tasks/:taskId", permanent: true },
        ];
    },
};

export default nextConfig;
