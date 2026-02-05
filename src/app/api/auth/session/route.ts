import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// This endpoint sets a session cookie after Firebase client-side auth
export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json(
                { error: "No ID token provided" },
                { status: 400 }
            );
        }

        // In production, verify the ID token with Firebase Admin SDK here
        // For now, we'll set a simple session cookie
        // TODO: Add Firebase Admin SDK verification

        // Set session cookie (httpOnly for security)
        const response = NextResponse.json({ success: true });

        // Session expires in 5 days
        const maxAge = 60 * 60 * 24 * 5;

        response.cookies.set({
            name: "session",
            value: idToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge,
            path: "/",
        });

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

        return response;
    } catch (error) {
        console.error("Error clearing session:", error);
        return NextResponse.json(
            { error: "Failed to clear session" },
            { status: 500 }
        );
    }
}
