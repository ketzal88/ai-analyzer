import * as admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (privateKey) {
            // Remove any potential surrounding quotes that some loaders might include
            privateKey = privateKey.replace(/^['"]|['"]$/g, '');

            // Critical part: normalize newlines.
            // If it already has real newlines, we keep them.
            // If it has literal \n characters, we convert them.
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        admin.firestore().settings({ ignoreUndefinedProperties: true });
        console.log("✅ Firebase Admin initialized successfully");
    } catch (error: any) {
        console.error("❌ Firebase Init Error:", error.message);
        // Important: In Next.js dev, we want to see this error clearly
    }
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
