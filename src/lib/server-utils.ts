import { auth } from "./firebase-admin";
import { NextRequest } from "next/server";

export async function getAdminStatus(request: NextRequest): Promise<{ isAdmin: boolean; uid?: string }> {
    try {
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return { isAdmin: false };

        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const adminUids = (process.env.ADMIN_UIDS || "").split(",");

        return {
            isAdmin: adminUids.includes(decodedToken.uid),
            uid: decodedToken.uid
        };
    } catch (error) {
        console.error("Admin check failed:", error);
        return { isAdmin: false };
    }
}
