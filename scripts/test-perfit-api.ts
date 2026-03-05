/**
 * Test Perfit API — Single client probe
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/test-perfit-api.ts
 */

import { db } from "../src/lib/firebase-admin";

const BASE_URL = "https://api.myperfit.com/v2";

async function main() {
  // Get first active client with perfit
  const snap = await db.collection("clients").where("active", "==", true).get();
  const client = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .find((c: any) => c.integraciones?.email === "perfit" && c.perfitApiKey);

  if (!client) {
    console.log("No Perfit client found");
    return;
  }

  console.log(`Testing with: ${client.name}`);
  console.log(`API Key prefix: ${client.perfitApiKey.substring(0, 10)}...`);

  const apiKey = client.perfitApiKey;
  const dashIdx = apiKey.indexOf("-");
  const accountId = apiKey.substring(0, dashIdx);
  console.log(`Account ID: ${accountId}`);

  // Test 1: Account info
  console.log("\n--- Test 1: Account Info ---");
  try {
    const res = await fetch(`${BASE_URL}/${accountId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Name: ${data.data?.name}`);
      console.log(`Plan: ${data.data?.plan?.state}`);
    } else {
      const text = await res.text();
      console.log(`Error: ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.log(`Fetch error: ${err.message}`);
  }

  // Test 2: Campaigns (just first page)
  console.log("\n--- Test 2: Campaigns (first page) ---");
  try {
    const res = await fetch(`${BASE_URL}/${accountId}/campaigns?offset=0&limit=5&sortby=launchDate&sortdir=desc`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      const campaigns = data.data || [];
      console.log(`Campaigns returned: ${campaigns.length}`);
      for (const c of campaigns.slice(0, 3)) {
        console.log(`  - ${c.name} | state: ${c.state} | launchDate: ${c.launchDate} | sent: ${c.metrics?.sent || 0}`);
      }
    } else {
      const text = await res.text();
      console.log(`Error: ${text.slice(0, 300)}`);
    }
  } catch (err: any) {
    console.log(`Fetch error: ${err.message}`);
  }

  // Test 3: Automations
  console.log("\n--- Test 3: Automations ---");
  try {
    const res = await fetch(`${BASE_URL}/${accountId}/automations`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      const autos = data.data || [];
      console.log(`Automations: ${autos.length}`);
      for (const a of autos.slice(0, 3)) {
        console.log(`  - ${a.name} | enabled: ${a.enabled} | triggered: ${a.stats?.triggered || 0}`);
      }
    } else {
      const text = await res.text();
      console.log(`Error: ${text.slice(0, 300)}`);
    }
  } catch (err: any) {
    console.log(`Fetch error: ${err.message}`);
  }
}

main().catch(console.error);
