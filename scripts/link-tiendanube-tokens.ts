/**
 * Link TiendaNube Tokens to Clients
 *
 * Step 1 (--dry-run or no flag): Shows pending tokens and clients needing credentials
 * Step 2 (--link): Actually links tokens to matching clients by name similarity
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/link-tiendanube-tokens.ts
 *   npx tsx --require ./scripts/load-env.cjs scripts/link-tiendanube-tokens.ts --link
 */

import { db } from "../src/lib/firebase-admin";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

interface PendingToken {
  storeId: string;
  accessToken: string;
  scope?: string;
  createdAt: string;
  linked: boolean;
  storeName?: string;
}

interface ClientNeedingCreds {
  id: string;
  name: string;
  tiendanubeStoreId?: string;
  tiendanubeAccessToken?: string;
}

async function getStoreName(storeId: string, accessToken: string): Promise<string> {
  try {
    const res = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
      headers: { Authentication: `bearer ${accessToken}`, "User-Agent": "Worker Brain (support@worker.com)" },
    });
    if (!res.ok) return `(API error ${res.status})`;
    const data = await res.json() as { name?: { es?: string; en?: string } };
    return data.name?.es || data.name?.en || "(no name)";
  } catch {
    return "(fetch error)";
  }
}

async function main() {
  const doLink = process.argv.includes("--link");

  console.log("=".repeat(70));
  console.log("  TiendaNube Token Linker");
  console.log(`  Mode: ${doLink ? "LINK (will write to DB)" : "DRY RUN (read only)"}`);
  console.log("=".repeat(70));

  // 1. Get all pending tokens
  const tokensSnap = await db.collection("tiendanube_auth_tokens").get();
  const tokens: PendingToken[] = tokensSnap.docs.map((doc) => ({
    storeId: doc.id,
    ...doc.data(),
  })) as PendingToken[];

  console.log(`\n  Tokens in tiendanube_auth_tokens: ${tokens.length}\n`);

  // 2. Get store names from TN API for each token
  for (const token of tokens) {
    token.storeName = await getStoreName(token.storeId, token.accessToken);
    const status = token.linked ? "[LINKED]" : "[PENDING]";
    console.log(`  ${status} Store #${token.storeId}: "${token.storeName}" (created: ${token.createdAt})`);
  }

  // 3. Get clients that need TN credentials
  const clientsSnap = await db.collection("clients").where("active", "==", true).get();
  const needsCreds: ClientNeedingCreds[] = [];
  const alreadyLinked: { id: string; name: string; storeId: string }[] = [];

  for (const doc of clientsSnap.docs) {
    const data = doc.data();
    if (data.integraciones?.ecommerce === "tiendanube") {
      if (data.tiendanubeStoreId && data.tiendanubeAccessToken) {
        alreadyLinked.push({ id: doc.id, name: data.name, storeId: data.tiendanubeStoreId });
      } else {
        needsCreds.push({ id: doc.id, name: data.name, tiendanubeStoreId: data.tiendanubeStoreId });
      }
    }
  }

  console.log(`\n  Clients with TN configured:`);
  console.log(`    Already linked: ${alreadyLinked.length}`);
  for (const c of alreadyLinked) {
    console.log(`      - ${c.name} -> Store #${c.storeId}`);
  }
  console.log(`    Needing credentials: ${needsCreds.length}`);
  for (const c of needsCreds) {
    console.log(`      - ${c.name} (${c.id})${c.tiendanubeStoreId ? ` has storeId=${c.tiendanubeStoreId} but no token` : ""}`);
  }

  // 4. Try to match tokens to clients
  const pendingTokens = tokens.filter((t) => !t.linked);
  console.log(`\n${"=".repeat(70)}`);
  console.log("  MATCHING TOKENS TO CLIENTS");
  console.log("=".repeat(70));

  const matches: { client: ClientNeedingCreds; token: PendingToken; confidence: string }[] = [];
  const unmatchedTokens: PendingToken[] = [];
  const unmatchedClients: ClientNeedingCreds[] = [...needsCreds];

  for (const token of pendingTokens) {
    const storeName = (token.storeName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Try exact-ish match by name
    let bestMatch: ClientNeedingCreds | null = null;
    let bestScore = 0;

    for (const client of unmatchedClients) {
      const clientName = client.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Check various match conditions
      if (clientName === storeName) {
        bestMatch = client;
        bestScore = 100;
        break;
      }
      if (storeName.includes(clientName) || clientName.includes(storeName)) {
        const score = 80;
        if (score > bestScore) {
          bestMatch = client;
          bestScore = score;
        }
      }
      // Word overlap
      const storeWords = storeName.split(/\s+/).filter((w) => w.length > 2);
      const clientWords = clientName.split(/\s+/).filter((w) => w.length > 2);
      const overlap = storeWords.filter((w) => clientWords.some((cw) => cw.includes(w) || w.includes(cw)));
      if (overlap.length > 0) {
        const score = Math.round((overlap.length / Math.max(storeWords.length, clientWords.length)) * 70);
        if (score > bestScore) {
          bestMatch = client;
          bestScore = score;
        }
      }
      // Levenshtein distance fallback for typos/letter swaps (e.g. "Andahlue" vs "Andalhue")
      const dist = levenshtein(clientName, storeName);
      const maxLen = Math.max(clientName.length, storeName.length);
      const similarity = Math.round(((maxLen - dist) / maxLen) * 100);
      if (similarity >= 70 && similarity > bestScore) {
        bestMatch = client;
        bestScore = similarity;
      }
    }

    if (bestMatch && bestScore >= 30) {
      const confidence = bestScore >= 80 ? "HIGH" : bestScore >= 50 ? "MEDIUM" : "LOW";
      matches.push({ client: bestMatch, token, confidence });
      unmatchedClients.splice(unmatchedClients.indexOf(bestMatch), 1);
    } else {
      unmatchedTokens.push(token);
    }
  }

  // Display matches
  if (matches.length > 0) {
    console.log(`\n  Matches found: ${matches.length}\n`);
    for (const m of matches) {
      console.log(`  [${m.confidence}] "${m.client.name}" <-> Store #${m.token.storeId} "${m.token.storeName}"`);
    }
  }

  if (unmatchedTokens.length > 0) {
    console.log(`\n  Unmatched tokens: ${unmatchedTokens.length}`);
    for (const t of unmatchedTokens) {
      console.log(`    Store #${t.storeId}: "${t.storeName}"`);
    }
  }

  if (unmatchedClients.length > 0) {
    console.log(`\n  Unmatched clients: ${unmatchedClients.length}`);
    for (const c of unmatchedClients) {
      console.log(`    ${c.name} (${c.id})`);
    }
  }

  // 5. Link if --link flag
  if (doLink && matches.length > 0) {
    console.log(`\n${"=".repeat(70)}`);
    console.log("  LINKING...");
    console.log("=".repeat(70));

    for (const m of matches) {
      try {
        await db.collection("clients").doc(m.client.id).update({
          tiendanubeStoreId: m.token.storeId,
          tiendanubeAccessToken: m.token.accessToken,
          updatedAt: new Date().toISOString(),
        });
        await db.collection("tiendanube_auth_tokens").doc(m.token.storeId).update({
          linked: true,
          linkedTo: m.client.id,
          linkedAt: new Date().toISOString(),
        });
        console.log(`  OK: ${m.client.name} -> Store #${m.token.storeId}`);
      } catch (err) {
        console.log(`  ERROR: ${m.client.name} -> ${err}`);
      }
    }
    console.log("\n  Done! Run the audit script again to verify.");
  } else if (doLink && matches.length === 0) {
    console.log("\n  No matches to link.");
  } else {
    console.log(`\n  To link matches, run with --link flag`);
  }
}

main().catch(console.error);
