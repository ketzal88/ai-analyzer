import { db } from "../src/lib/firebase-admin";

async function main() {
  const snap = await db.collection("clients").where("active", "==", true).get();
  const clients = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  clients.sort((a: any, b: any) => a.name.localeCompare(b.name));

  console.log("META ADS CONFIG — All Active Clients\n");
  console.log("Client".padEnd(25) + "meta?".padEnd(8) + "metaAdAccountId".padEnd(25) + "Status");
  console.log("-".repeat(80));

  for (const c of clients) {
    const metaFlag = c.integraciones?.meta ? "YES" : "no";
    const accountId = c.metaAdAccountId || "(missing)";
    let status = "";
    if (c.integraciones?.meta && c.metaAdAccountId) status = "OK";
    else if (c.integraciones?.meta && !c.metaAdAccountId) status = "FLAG ON, NO ID";
    else if (!c.integraciones?.meta && c.metaAdAccountId) status = "HAS ID, FLAG OFF";
    else status = "not configured";

    console.log(c.name.padEnd(25) + metaFlag.padEnd(8) + accountId.padEnd(25) + status);
  }
}

main().catch(console.error);
