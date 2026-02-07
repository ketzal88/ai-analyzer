const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectReport() {
    const id = "bgSgwWB7Qutcs8SNa3bP__120238662388150623__2026-01-24_2026-02-07__p1";
    const snap = await db.collection("creative_ai_reports").doc(id).get();
    if (snap.exists) {
        console.log(JSON.stringify(snap.data(), null, 2));
    } else {
        console.log("Report not found");
    }
}

inspectReport();
