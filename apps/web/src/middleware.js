import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

// Public marketing & informational routes — browsable without signing in.
const MARKETING_PATHS = [
    "/pricing",
    "/about",
    "/blog",
    "/careers",
    "/changelog",
    "/contact",
    "/cookies",
    "/docs",
    "/dpa",
    "/help",
    "/privacy",
    "/roadmap",
    "/security",
    "/status",
    "/terms",
];

function isAuthPath(pathname) {
    return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isMarketingPath(pathname) {
    return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        const isPublic = pathname === "/" || pathname === "/join" || isMarketingPath(pathname);

        // Authenticated users on auth pages → redirect based on onboarding status
        if (token && isAuthPath(pathname)) {
            if (!token.onboarded) return NextResponse.redirect(new URL("/onboarding", req.url));
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // Authenticated users not yet onboarded → send to onboarding
        if (token && pathname !== "/onboarding" && !isAuthPath(pathname) && !token.onboarded) {
            return NextResponse.redirect(new URL("/onboarding", req.url));
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized({ req, token }) {
                const { pathname } = req.nextUrl;
                const isPublic =
                    pathname === "/" ||
                    pathname === "/join" ||
                    pathname === "/onboarding" ||
                    isAuthPath(pathname) ||
                    isMarketingPath(pathname);
                return isPublic || !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|opengraph-image|manifest.webmanifest|sw.js|icons|robots.txt|sitemap.xml).*)",
    ],
};
