/**
 * One-time script: Assign teams to clients based on predefined mapping.
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/assign-teams.ts
 */
import { db } from "../src/lib/firebase-admin";

const CLIENT_TEAM_MAP: Record<string, string> = {
    // Team MasivoBro
    "Paia": "MasivoBro",
    "Almacen de Colchones": "MasivoBro",
    "TheMinimal Co": "MasivoBro",
    "Cover UP": "MasivoBro",
    "Black Horn": "MasivoBro",
    "Coco Nude": "MasivoBro",
    "Valker": "MasivoBro",
    "Pietra Essentials": "MasivoBro",
    // Team Milagro
    "Andahlue": "Milagro",
    "Hogar en Tela": "Milagro",
    "Nápoles": "Milagro",
    "Escaladio": "Milagro",
    "Nascentis": "Milagro",
    "Casa Nostra": "Milagro",
    "Vinitus": "Milagro",
    // Team Perfeccion
    "Phone Case": "Perfección",
    "Accuracy": "Perfección",
    "Deco Bluna": "Perfección",
    "Carrara": "Perfección",
    "Galo Handmade": "Perfección",
    "Presencia": "Perfección",
    "Simoneta": "Perfección",
    "Blunua": "Perfección",
    // Team Pimpolluelos
    "Cordoba Notebooks": "Pimpolluelos",
    "Luvee": "Pimpolluelos",
    "Shallpass": "Pimpolluelos",
    "Cavego": "Pimpolluelos",
    "Cambre": "Pimpolluelos",
};

async function main() {
    // 1. Fetch all teams to get ID → name mapping
    const teamsSnap = await db.collection("teams").get();
    const teamNameToId: Record<string, string> = {};
    teamsSnap.docs.forEach(doc => {
        const data = doc.data();
        teamNameToId[data.name] = doc.id;
    });

    console.log("Teams found:", Object.keys(teamNameToId).join(", "));

    // 2. Fetch all clients
    const clientsSnap = await db.collection("clients").get();
    const clients = clientsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));

    console.log(`\nClients found: ${clients.length}`);

    // 3. Match and update
    let updated = 0;
    let notFound = 0;

    for (const [clientName, teamName] of Object.entries(CLIENT_TEAM_MAP)) {
        const teamId = teamNameToId[teamName];
        if (!teamId) {
            console.error(`  ✗ Team "${teamName}" not found in Firestore!`);
            continue;
        }

        // Find client by name (case-insensitive, trimmed)
        const client = clients.find(c =>
            c.name.trim().toLowerCase() === clientName.trim().toLowerCase()
        );

        if (!client) {
            console.warn(`  ? Client "${clientName}" not found in Firestore`);
            notFound++;
            continue;
        }

        await db.collection("clients").doc(client.id).update({
            team: teamId,
            updatedAt: new Date().toISOString(),
        });

        console.log(`  ✓ ${client.name} → ${teamName}`);
        updated++;
    }

    console.log(`\nDone! Updated: ${updated}, Not found: ${notFound}`);
}

main().catch(console.error);
