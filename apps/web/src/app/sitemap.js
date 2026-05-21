const BASE = "https://flexflow-one.vercel.app";

export default function sitemap() {
    return [
        { url: BASE, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
        { url: `${BASE}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.8 },
        { url: `${BASE}/register`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.8 },
        { url: `${BASE}/forgot-password`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    ];
}
