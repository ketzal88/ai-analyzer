/**
 * One-time client rename endpoint
 *
 * GET /api/admin/rename-clients
 *
 * Renames clients in Firestore.
 * Also updates slugs accordingly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// Map: old name → { newName, newSlug }
const renames: Record<string, { newName: string; newSlug: string }> = {
  'Accuracy': { newName: 'Accuracy Solutions', newSlug: 'accuracy-solutions' },
  'Carrara Design': { newName: 'Carrara', newSlug: 'carrara' },
  'CasaNostra': { newName: 'Casa Nostra', newSlug: 'casa-nostra' },
  'Cordoba Notebook': { newName: 'Cordoba Notebooks', newSlug: 'cordoba-notebooks' },
  'TheMinimalCo': { newName: 'The Minimal Co', newSlug: 'the-minimal-co' },
  'Anadalhue': { newName: 'Tienda Andalue', newSlug: 'tienda-andalue' },
};

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    const clientsSnap = await db.collection('clients').get();

    for (const doc of clientsSnap.docs) {
      const data = doc.data();
      const rename = renames[data.name];

      if (rename) {
        await doc.ref.update({
          name: rename.newName,
          slug: rename.newSlug,
          updatedAt: new Date().toISOString()
        });

        results.push({
          id: doc.id,
          oldName: data.name,
          newName: rename.newName,
          oldSlug: data.slug,
          newSlug: rename.newSlug,
          status: 'renamed'
        });
      }
    }

    return NextResponse.json({
      success: true,
      renamed: results.length,
      details: results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
