import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/join"];
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
        const isOnboarding = pathname === "/onboarding";

        // Authenticated users on auth pages → redirect based on onboarding status
        if (token && isAuthPath) {
            if (!token.onboarded) return NextResponse.redirect(new URL("/onboarding", req.url));
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // Authenticated users not yet onboarded → send to onboarding
        if (token && !isOnboarding && !isAuthPath && !token.onboarded) {
            return NextResponse.redirect(new URL("/onboarding", req.url));
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized({ req, token }) {
                const { pathname } = req.nextUrl;
                const isPublic =
                    PUBLIC_PATHS.some((p) => pathname === p) ||
                    AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
                    pathname === "/onboarding";
                return isPublic || !!token;
            },
        },
    }
);

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|opengraph-image).*)"],
};
