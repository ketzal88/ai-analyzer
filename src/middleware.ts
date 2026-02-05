import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/select-account", "/dashboard", "/findings", "/report", "/admin"];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ["/"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get the session cookie (we'll set this after Firebase auth)
    const sessionCookie = request.cookies.get("session");

    // Check if the route is protected
    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );

    // Check if the route is an auth route
    const isAuthRoute = authRoutes.includes(pathname);

    // If trying to access protected route without session, redirect to login
    if (isProtectedRoute && !sessionCookie) {
        const url = new URL("/", request.url);
        return NextResponse.redirect(url);
    }

    // Admin Route Protection
    if (pathname.startsWith("/admin")) {
        const uid = request.cookies.get("uid")?.value;
        const adminUids = (process.env.ADMIN_UIDS || "").split(",");

        if (!uid || !adminUids.includes(uid)) {
            const url = new URL("/dashboard", request.url);
            return NextResponse.redirect(url);
        }
    }

    // If trying to access auth route with session, redirect to select-account
    if (isAuthRoute && sessionCookie) {
        const url = new URL("/select-account", request.url);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
