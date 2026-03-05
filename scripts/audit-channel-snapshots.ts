/**
 * Audit Script: Channel Snapshots Coverage Q1 2026
 *
 * Checks every active client's configured channels and reports
 * which days have snapshots and which are missing.
 *
 * Usage: npx tsx --require ./scripts/load-env.cjs scripts/audit-channel-snapshots.ts
 */

import { db } from "../src/lib/firebase-admin";

const START_DATE = "2026-01-01";
const END_DATE = "2026-03-04"; // yesterday

interface ClientConfig {
  id: string;
  name: string;
  active: boolean;
  businessType?: string;
  metaAdAccountId?: string;
  googleAdsId?: string;
  integraciones?: {
    meta?: boolean;
    google?: boolean;
    ecommerce?: "tiendanube" | "shopify" | "woocommerce" | null;
    email?: "klaviyo" | "perfit" | null;
  };
  tiendanubeStoreId?: string;
  tiendanubeAccessToken?: string;
  shopifyStoreDomain?: string;
  shopifyAccessToken?: string;
  woocommerceStoreDomain?: string;
  woocommerceConsumerKey?: string;
  woocommerceConsumerSecret?: string;
  klaviyoApiKey?: string;
  perfitApiKey?: string;
}

type ChannelType = "META" | "GOOGLE" | "ECOMMERCE" | "EMAIL";

interface ChannelAudit {
  channel: ChannelType;
  platform: string;
  expectedDays: number;
  foundDays: number;
  missingDays: string[];
  coverage: number;
  hasCredentials: boolean;
}

interface ClientAudit {
  clientId: string;
  clientName: string;
  businessType: string;
  channels: ChannelAudit[];
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (current <= last) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function getExpectedChannels(client: ClientConfig): { channel: ChannelType; platform: string; hasCredentials: boolean }[] {
  const channels: { channel: ChannelType; platform: string; hasCredentials: boolean }[] = [];

  if (client.integraciones?.meta && client.metaAdAccountId) {
    channels.push({ channel: "META", platform: "meta", hasCredentials: true });
  } else if (client.integraciones?.meta) {
    channels.push({ channel: "META", platform: "meta", hasCredentials: false });
  }

  if (client.integraciones?.google && client.googleAdsId) {
    channels.push({ channel: "GOOGLE", platform: "google", hasCredentials: true });
  } else if (client.integraciones?.google) {
    channels.push({ channel: "GOOGLE", platform: "google", hasCredentials: false });
  }

  const ecom = client.integraciones?.ecommerce;
  if (ecom === "shopify") {
    channels.push({
      channel: "ECOMMERCE",
      platform: "shopify",
      hasCredentials: !!(client.shopifyStoreDomain && client.shopifyAccessToken),
    });
  } else if (ecom === "tiendanube") {
    channels.push({
      channel: "ECOMMERCE",
      platform: "tiendanube",
      hasCredentials: !!(client.tiendanubeStoreId && client.tiendanubeAccessToken),
    });
  } else if (ecom === "woocommerce") {
    channels.push({
      channel: "ECOMMERCE",
      platform: "woocommerce",
      hasCredentials: !!(client.woocommerceStoreDomain && client.woocommerceConsumerKey && client.woocommerceConsumerSecret),
    });
  }

  const email = client.integraciones?.email;
  if (email === "klaviyo") {
    channels.push({
      channel: "EMAIL",
      platform: "klaviyo",
      hasCredentials: !!client.klaviyoApiKey,
    });
  } else if (email === "perfit") {
    channels.push({
      channel: "EMAIL",
      platform: "perfit",
      hasCredentials: !!client.perfitApiKey,
    });
  }

  return channels;
}

async function auditClient(client: ClientConfig, allDates: string[]): Promise<ClientAudit> {
  const expectedChannels = getExpectedChannels(client);
  const channels: ChannelAudit[] = [];

  for (const { channel, platform, hasCredentials } of expectedChannels) {
    // Use document ID range query — doc IDs are: clientId__CHANNEL__YYYY-MM-DD
    const prefix = `${client.id}__${channel}__`;
    const snap = await db
      .collection("channel_snapshots")
      .where("__name__", ">=", prefix + START_DATE)
      .where("__name__", "<=", prefix + END_DATE)
      .get();

    const foundDates = new Set<string>();
    snap.docs.forEach((doc) => {
      // Extract date from doc ID: clientId__CHANNEL__YYYY-MM-DD
      const parts = doc.id.split("__");
      const date = parts[parts.length - 1];
      if (date) foundDates.add(date);
    });

    const missingDays = allDates.filter((d) => !foundDates.has(d));

    channels.push({
      channel,
      platform,
      expectedDays: allDates.length,
      foundDays: foundDates.size,
      missingDays,
      coverage: Math.round((foundDates.size / allDates.length) * 100),
      hasCredentials,
    });
  }

  return { clientId: client.id, clientName: client.name, businessType: client.businessType || "unknown", channels };
}

function compressDateRanges(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(prev + "T12:00:00Z");
    const currDate = new Date(sorted[i] + "T12:00:00Z");
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? start : `${start} -> ${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? start : `${start} -> ${prev}`);
  return ranges.join(", ");
}

async function main() {
  console.log("=".repeat(80));
  console.log("  AUDIT: Channel Snapshots Coverage - Q1 2026");
  console.log(`  Range: ${START_DATE} -> ${END_DATE}`);
  console.log("=".repeat(80));

  const allDates = generateDateRange(START_DATE, END_DATE);
  console.log(`\n  Expected days per channel: ${allDates.length}\n`);

  // Load all active clients
  const clientsSnap = await db.collection("clients").where("active", "==", true).get();
  const clients: ClientConfig[] = clientsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientConfig[];

  console.log(`  Active clients: ${clients.length}\n`);
  console.log("-".repeat(80));

  const allAudits: ClientAudit[] = [];

  // Process clients in parallel batches of 5
  for (let i = 0; i < clients.length; i += 5) {
    const batch = clients.slice(i, i + 5);
    const results = await Promise.all(batch.map((c) => auditClient(c, allDates)));
    allAudits.push(...results);
  }

  // Sort by client name
  allAudits.sort((a, b) => a.clientName.localeCompare(b.clientName));

  // -- Per-client report --
  for (const audit of allAudits) {
    if (audit.channels.length === 0) continue;

    console.log(`\n  ${audit.clientName} [${audit.businessType}] (${audit.clientId})`);

    for (const ch of audit.channels) {
      const icon = ch.coverage === 100 ? "[OK]" : ch.coverage >= 80 ? "[80%+]" : ch.coverage > 0 ? "[PARTIAL]" : "[EMPTY]";
      const credWarn = ch.hasCredentials ? "" : " << NO CREDENTIALS >>";
      console.log(
        `     ${icon} ${ch.channel} (${ch.platform}): ${ch.foundDays}/${ch.expectedDays} days (${ch.coverage}%)${credWarn}`
      );

      if (ch.missingDays.length > 0 && ch.missingDays.length <= 10) {
        console.log(`        Missing: ${ch.missingDays.join(", ")}`);
      } else if (ch.missingDays.length > 10) {
        const ranges = compressDateRanges(ch.missingDays);
        console.log(`        Missing: ${ranges}`);
      }
    }
  }

  // -- Summary table --
  console.log("\n" + "=".repeat(80));
  console.log("  SUMMARY BY CHANNEL");
  console.log("=".repeat(80));

  const channelSummary: Record<string, { total: number; complete: number; partial: number; empty: number; noCreds: number }> = {};

  for (const audit of allAudits) {
    for (const ch of audit.channels) {
      const key = `${ch.channel} (${ch.platform})`;
      if (!channelSummary[key]) channelSummary[key] = { total: 0, complete: 0, partial: 0, empty: 0, noCreds: 0 };
      channelSummary[key].total++;
      if (!ch.hasCredentials) channelSummary[key].noCreds++;
      else if (ch.coverage === 100) channelSummary[key].complete++;
      else if (ch.coverage > 0) channelSummary[key].partial++;
      else channelSummary[key].empty++;
    }
  }

  for (const [key, s] of Object.entries(channelSummary).sort()) {
    console.log(`\n  ${key}:`);
    console.log(`     Total clients: ${s.total}`);
    if (s.complete > 0) console.log(`     [OK] Complete (100%): ${s.complete}`);
    if (s.partial > 0) console.log(`     [PARTIAL]: ${s.partial}`);
    if (s.empty > 0) console.log(`     [EMPTY] (0%): ${s.empty}`);
    if (s.noCreds > 0) console.log(`     [NO CREDS]: ${s.noCreds}`);
  }

  // -- Clients with NO channels configured --
  const noChannels = allAudits.filter((a) => a.channels.length === 0);
  if (noChannels.length > 0) {
    console.log("\n" + "-".repeat(80));
    console.log("  CLIENTS WITH NO CHANNELS CONFIGURED:");
    for (const a of noChannels) {
      console.log(`     - ${a.clientName} [${a.businessType}] (${a.clientId})`);
    }
  }

  // -- Credential issues --
  const credIssues = allAudits.flatMap((a) =>
    a.channels.filter((ch) => !ch.hasCredentials).map((ch) => ({ client: a.clientName, clientId: a.clientId, ...ch }))
  );
  if (credIssues.length > 0) {
    console.log("\n" + "-".repeat(80));
    console.log("  CREDENTIAL ISSUES (integration configured but missing keys):");
    for (const ci of credIssues) {
      console.log(`     - ${ci.client}: ${ci.channel} (${ci.platform})`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("  AUDIT COMPLETE");
  console.log("=".repeat(80));
}

main().catch(console.error);
