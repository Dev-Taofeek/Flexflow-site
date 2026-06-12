/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "avatars.githubusercontent.com" },
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
            { protocol: "https", hostname: "*.cloudinary.com" },
            { protocol: "https", hostname: "*.supabase.co" },
        ],
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
