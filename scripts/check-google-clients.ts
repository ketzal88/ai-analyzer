import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

async function main() {
  const snap = await db.collection('clients').where('active', '==', true).get();
  const clients = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  console.log('\n=== CLIENTES CON ALGO DE GOOGLE ===\n');

  let bothOk = 0, missingId = 0, missingFlag = 0, noGoogle = 0;

  for (const c of clients.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))) {
    const hasFlag = !!c.integraciones?.google;
    const hasId = !!c.googleAdsId;

    if (!hasFlag && !hasId) { noGoogle++; continue; }

    let status = '';
    if (hasFlag && hasId) { status = 'OK'; bothOk++; }
    else if (hasFlag && !hasId) { status = 'FALTA googleAdsId'; missingId++; }
    else if (!hasFlag && hasId) { status = 'FALTA integraciones.google=true'; missingFlag++; }

    console.log(`${(c.name || c.id).padEnd(30)} google=${String(hasFlag).padEnd(6)} googleAdsId=${(c.googleAdsId || '-').toString().padEnd(16)} ${status}`);
  }

  console.log('\n=== RESUMEN ===');
  console.log(`OK (ambos campos):           ${bothOk}`);
  console.log(`Falta googleAdsId:           ${missingId}`);
  console.log(`Falta integraciones.google:  ${missingFlag}`);
  console.log(`Sin Google:                  ${noGoogle}`);
  console.log(`Total activos:               ${clients.length}`);
}

main().then(() => process.exit(0));
