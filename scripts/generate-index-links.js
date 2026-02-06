#!/usr/bin/env node

/**
 * Script para generar links directos de Firebase Console
 * Lee el Project ID del archivo .env.local
 * 
 * Uso: node scripts/generate-index-links-simple.js
 */

const fs = require('fs');
const path = require('path');

// Leer .env.local
const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
    console.error('❌ Error: No se encontró el archivo .env.local');
    console.log('\n💡 Solución:');
    console.log('1. Crea un archivo .env.local en la raíz del proyecto');
    console.log('2. Agrega: NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const projectIdMatch = envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);

if (!projectIdMatch) {
    console.error('❌ Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID no encontrado en .env.local');
    console.log('\n💡 Solución:');
    console.log('Agrega esta línea a tu .env.local:');
    console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id');
    process.exit(1);
}

const PROJECT_ID = projectIdMatch[1].trim();

console.log(`\n🔥 Firebase Project ID: ${PROJECT_ID}\n`);
console.log('📋 Links directos para crear índices en Firestore:\n');
console.log('='.repeat(80));

const indexes = [
    {
        name: '1. meta_creatives: clientId + lastSeenActiveAt (DESC)',
        description: 'Query base para creativos activos recientes',
        collection: 'meta_creatives',
        fields: [
            { field: 'clientId', order: 'ASCENDING' },
            { field: 'lastSeenActiveAt', order: 'DESCENDING' }
        ],
        priority: '🔴 CRÍTICO',
        url: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy8ke1BST0pFQ1RfSUR9L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tZXRhX2NyZWF0aXZlcy9pbmRleGVzL18QARoOCgpjbGllbnRJZBABGg4KCmxhc3RTZWVuQWN0aXZlQXQQAhoMCghfX25hbWVfXxAC`
    },
    {
        name: '2. meta_creatives: clientId + campaign.id + lastSeenActiveAt (DESC)',
        description: 'Filtrar creativos por campaña específica',
        collection: 'meta_creatives',
        fields: [
            { field: 'clientId', order: 'ASCENDING' },
            { field: 'campaign.id', order: 'ASCENDING' },
            { field: 'lastSeenActiveAt', order: 'DESCENDING' }
        ],
        priority: '🟡 OPCIONAL',
        url: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy8ke1BST0pFQ1RfSUR9L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tZXRhX2NyZWF0aXZlcy9pbmRleGVzL18QARoOCgpjbGllbnRJZBABGhEKDWNhbXBhaWduLmlkEAEaDgoKbGFzdFNlZW5BY3RpdmVBdBACGgwKCF9fbmFtZV9fEAI`
    },
    {
        name: '3. meta_creatives: clientId + creative.format + lastSeenActiveAt (DESC)',
        description: 'Filtrar creativos por formato (IMAGE, VIDEO, etc.)',
        collection: 'meta_creatives',
        fields: [
            { field: 'clientId', order: 'ASCENDING' },
            { field: 'creative.format', order: 'ASCENDING' },
            { field: 'lastSeenActiveAt', order: 'DESCENDING' }
        ],
        priority: '🟡 OPCIONAL',
        url: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy8ke1BST0pFQ1RfSUR9L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tZXRhX2NyZWF0aXZlcy9pbmRleGVzL18QARoOCgpjbGllbnRJZBABGhIKDmNyZWF0aXZlLmZvcm1hdBABGg4KCmxhc3RTZWVuQWN0aXZlQXQQAhoMCghfX25hbWVfXxAC`
    },
    {
        name: '4. meta_creatives: clientId + status + lastSeenActiveAt (DESC)',
        description: 'Filtrar creativos por status (ACTIVE, PAUSED, etc.)',
        collection: 'meta_creatives',
        fields: [
            { field: 'clientId', order: 'ASCENDING' },
            { field: 'status', order: 'ASCENDING' },
            { field: 'lastSeenActiveAt', order: 'DESCENDING' }
        ],
        priority: '🟡 OPCIONAL',
        url: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy8ke1BST0pFQ1RfSUR9L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tZXRhX2NyZWF0aXZlcy9pbmRleGVzL18QARoOCgpjbGllbnRJZBABGg0KCXN0YXR1cxABGg4KCmxhc3RTZWVuQWN0aXZlQXQQAhoMCghfX25hbWVfXxAC`
    },
    {
        name: '5. insights_daily: clientId + date (ASC)',
        description: 'Query de insights por rango de fechas (AG-42)',
        collection: 'insights_daily',
        fields: [
            { field: 'clientId', order: 'ASCENDING' },
            { field: 'date', order: 'ASCENDING' }
        ],
        priority: '🔴 CRÍTICO',
        url: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cl9wcm9qZWN0cy8ke1BST0pFQ1RfSUR9L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9pbnNpZ2h0c19kYWlseS9pbmRleGVzL18QARoOCgpjbGllbnRJZBABGgsKB2RhdGUQARoMCghfX25hbWVfXxAC`
    }
];

indexes.forEach((index, i) => {
    console.log(`\n${index.priority} ${index.name}`);
    console.log(`📝 ${index.description}`);
    console.log(`\n🔗 Link directo:`);
    console.log(index.url);

    console.log(`\n📊 Campos:`);
    index.fields.forEach((f, j) => {
        console.log(`   ${j + 1}. ${f.field} → ${f.order}`);
    });

    if (i < indexes.length - 1) {
        console.log('\n' + '-'.repeat(80));
    }
});

console.log('\n' + '='.repeat(80));
console.log('\n✅ Instrucciones:');
console.log('1. Haz clic en cada link (Ctrl+Click en la terminal)');
console.log('2. Revisa que los campos estén correctos');
console.log('3. Haz clic en "Create Index"');
console.log('4. Espera a que el estado sea "Enabled" (puede tardar varios minutos)');
console.log('\n💡 Tip: Crea primero los índices marcados como 🔴 CRÍTICO\n');

// También generar comandos CLI
console.log('\n📦 Alternativa: Firebase CLI\n');
console.log('Copia y pega estos comandos:\n');

indexes.forEach((index) => {
    const fieldsStr = index.fields
        .map(f => `--field ${f.field}:${f.order.toLowerCase()}`)
        .join(' \\\n  ');

    console.log(`# ${index.name}`);
    console.log(`firebase firestore:indexes:create \\`);
    console.log(`  --project ${PROJECT_ID} \\`);
    console.log(`  --collection-group ${index.collection} \\`);
    console.log(`  ${fieldsStr}\n`);
});

console.log('\n🎯 Verificación:');
console.log(`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes\n`);

// Guardar links en archivo
const outputPath = path.join(__dirname, '..', 'FIRESTORE_INDEX_LINKS.txt');
const output = indexes.map(index => `${index.name}\n${index.url}\n`).join('\n');
fs.writeFileSync(outputPath, output);
console.log(`💾 Links guardados en: FIRESTORE_INDEX_LINKS.txt\n`);
