/**
 * Find and delete the "Juan Perez" test lead.
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/delete-test-lead.ts
 */
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

async function main() {
  // Search by multiple name variants and phone
  const queries = [
    db.collection("leads").where("name", "==", "Juan Perez").get(),
    db.collection("leads").where("name", "==", "Juan Pérez").get(),
    db.collection("leads").where("phone", "==", "+5491155551234").get(),
    db.collection("leads").where("phone", "==", "5491155551234").get(),
  ];

  const results = await Promise.all(queries);
  const docIds = new Set<string>();

  for (const snap of results) {
    snap.forEach((doc) => {
      docIds.add(doc.id);
      console.log(`Found: ${doc.id} — ${doc.data().name} | ${doc.data().phone} | clientId: ${doc.data().clientId}`);
    });
  }

  if (docIds.size === 0) {
    console.log("No test lead found.");
    return;
  }

  for (const id of docIds) {
    await db.collection("leads").doc(id).delete();
    console.log(`🗑️  Deleted: ${id}`);
  }

  console.log(`\n✅ Deleted ${docIds.size} test lead(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
