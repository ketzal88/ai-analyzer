import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";

// This endpoint sets a session cookie after Firebase client-side auth
export async function POST(request: NextRequest) {
    try {
        const { idToken, uid } = await request.json();

        if (!idToken) {
            return NextResponse.json(
                { error: "No ID token provided" },
                { status: 400 }
            );
        }

        // 1. Create a session cookie using Firebase Admin SDK
        // This makes the cookie verifiable by auth.verifySessionCookie()
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in milliseconds
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

        // Set session cookies (httpOnly for security)
        const response = NextResponse.json({ success: true });

        // Session expires in 5 days
        const maxAge = 60 * 60 * 24 * 5;

        response.cookies.set({
            name: "session",
            value: sessionCookie,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge,
            path: "/",
        });

        if (uid) {
            response.cookies.set({
                name: "uid",
                value: uid,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge,
                path: "/",
            });
        }

        return response;
    } catch (error) {
        console.error("Error setting session:", error);
        return NextResponse.json(
            { error: "Failed to set session" },
            { status: 500 }
        );
    }
}

// Clear session cookie on logout
export async function DELETE() {
    try {
        const response = NextResponse.json({ success: true });

        response.cookies.set({
            name: "session",
            value: "",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 0,
            path: "/",
        });

        response.cookies.set({
            name: "uid",
            value: "",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 0,
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Error clearing session:", error);
        return NextResponse.json(
            { error: "Failed to clear session" },
            { status: 500 }
        );
    }
}
