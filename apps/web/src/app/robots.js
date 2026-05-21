export default function robots() {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/login", "/register", "/forgot-password"],
                disallow: ["/dashboard", "/projects", "/analytics", "/team", "/settings", "/onboarding"],
            },
        ],
        sitemap: "https://flexflow-one.vercel.app/sitemap.xml",
    };
}
