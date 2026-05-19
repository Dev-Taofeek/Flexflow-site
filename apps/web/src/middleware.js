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

        // Authenticated users away from auth pages
        if (token && isAuthPath) {
            const hasOrg = token.organizations?.length > 0;
            if (!token.onboarded || !hasOrg) {
                return NextResponse.redirect(new URL("/onboarding", req.url));
            }
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // Authenticated users without an org → onboarding
        if (token && !isOnboarding && !isAuthPath) {
            const hasOrg = token.organizations?.length > 0;
            if (!token.onboarded || !hasOrg) {
                return NextResponse.redirect(new URL("/onboarding", req.url));
            }
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
