/**
 * Check Dashbo Data — Debug Script
 *
 * Verifica qué datos existen en dashbo_snapshots para el cliente piloto
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();
const PILOT_CLIENT_ID = 'zPIorY5SDvoUQ1zTEFqi';

async function checkData() {
  console.log('\n🔍 CHECKING DASHBO_SNAPSHOTS DATA');
  console.log('═'.repeat(80));
  console.log(`Cliente: ${PILOT_CLIENT_ID}\n`);

  // Check what dates exist
  const dates = ['2026-02-22', '2026-02-23', '2026-02-24', '2026-02-25'];

  for (const date of dates) {
    const docRef = db.doc(`dashbo_snapshots/${PILOT_CLIENT_ID}/${date}/meta`);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      const counts = {
        account: data?.account?.length || 0,
        campaign: data?.campaign?.length || 0,
        adset: data?.adset?.length || 0,
        ad: data?.ad?.length || 0
      };
      const total = counts.account + counts.campaign + counts.adset + counts.ad;

      console.log(`✅ ${date}: ${total} snapshots`);
      console.log(`   - Account: ${counts.account}`);
      console.log(`   - Campaign: ${counts.campaign}`);
      console.log(`   - Adset: ${counts.adset}`);
      console.log(`   - Ad: ${counts.ad}`);
      console.log(`   - Updated: ${data?.updatedAt || 'N/A'}`);
    } else {
      console.log(`❌ ${date}: NO DATA`);
    }
    console.log('');
  }

  // Also check one date in detail
  console.log('\n📦 DETAILED CHECK: 2026-02-25');
  console.log('═'.repeat(80));
  const detailDoc = await db.doc(`dashbo_snapshots/${PILOT_CLIENT_ID}/2026-02-25/meta`).get();

  if (detailDoc.exists) {
    const data = detailDoc.data();
    console.log('Document exists: YES');
    console.log('Fields:', Object.keys(data || {}));

    if (data?.account && data.account.length > 0) {
      console.log('\nSample account snapshot:');
      console.log(JSON.stringify(data.account[0], null, 2).substring(0, 500) + '...');
    }
  } else {
    console.log('Document exists: NO');
  }

  console.log('\n═'.repeat(80));
}

checkData()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
