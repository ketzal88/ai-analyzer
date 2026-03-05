import { db } from "../src/lib/firebase-admin";

async function main() {
  const snap = await db.collection("clients").where("active", "==", true).get();
  let fixed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.metaAdAccountId && !data.integraciones?.meta) {
      await doc.ref.update({
        "integraciones.meta": true,
        updatedAt: new Date().toISOString(),
      });
      console.log(`  OK: ${data.name} -> integraciones.meta = true`);
      fixed++;
    }
  }

  console.log(`\n  Fixed: ${fixed} clients`);
}

main().catch(console.error);
