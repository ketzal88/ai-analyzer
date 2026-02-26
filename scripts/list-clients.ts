/**
 * List Clients Helper Script
 *
 * Lista todos los clientes en Firestore con su ID y nombre
 * para facilitar la selección del cliente piloto.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
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

async function listClients() {
  console.log('\n📋 CLIENTES EN FIRESTORE');
  console.log('═'.repeat(80));

  const snapshot = await db.collection('clients').get();

  if (snapshot.empty) {
    console.log('⚠️  No hay clientes en la base de datos');
    return;
  }

  const clients: any[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Ordenar por nombre
  clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`Total de clientes: ${clients.length}\n`);

  clients.forEach((client: any, index) => {
    const active = client.active ? '✅' : '❌';
    const meta = client.metaAdAccountId ? '📱 Meta' : '';
    const google = client.isGoogle ? '🔍 Google' : '';

    console.log(`${index + 1}. ${active} ${client.name || 'Sin nombre'}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Slug: ${client.slug || 'N/A'}`);
    console.log(`   Canales: ${meta} ${google}`);
    console.log(`   Tipo: ${client.businessType || 'N/A'}`);
    console.log('');
  });

  console.log('═'.repeat(80) + '\n');

  // Buscar específicamente "Almacén de Colchones"
  const almacen: any = clients.find((c: any) =>
    c.name?.toLowerCase().includes('almac') ||
    c.name?.toLowerCase().includes('colchon')
  );

  if (almacen) {
    console.log('🎯 CLIENTE ENCONTRADO: Almacén de Colchones');
    console.log('═'.repeat(80));
    console.log(`Nombre: ${almacen.name}`);
    console.log(`ID: ${almacen.id}`);
    console.log(`Slug: ${almacen.slug || 'N/A'}`);
    console.log(`\n💡 Para migrar este cliente, ejecuta:`);
    console.log(`\nnpx ts-node scripts/migrate-pilot-client.ts --clientId=${almacen.id} --days=7\n`);
  }
}

listClients()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
