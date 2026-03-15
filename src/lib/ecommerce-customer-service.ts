import { db } from "@/lib/firebase-admin";
import {
    EcommerceCustomer,
    EcommercePlatform,
    buildEcommerceCustomerId,
    getCohortTier,
    CustomerIntelligence,
    CohortStats,
} from "@/types/ecommerce-customer";

const COLLECTION = "ecommerce_customers";

interface OrderInput {
    customerId: string;
    email?: string;
    date: string;       // YYYY-MM-DD
    totalPrice: number;
}

export class EcommerceCustomerService {

    /**
     * Batch upsert customers from a set of orders.
     * Groups by customerId first to handle multiple orders per customer in same sync.
     */
    static async upsertFromOrders(
        clientId: string,
        platform: EcommercePlatform,
        orders: OrderInput[]
    ): Promise<number> {
        if (orders.length === 0) return 0;

        // Group orders by customer
        const byCustomer = new Map<string, { orders: OrderInput[]; totalSpent: number }>();
        for (const order of orders) {
            if (!order.customerId || order.customerId === "0") continue;
            const existing = byCustomer.get(order.customerId);
            if (existing) {
                existing.orders.push(order);
                existing.totalSpent += order.totalPrice;
            } else {
                byCustomer.set(order.customerId, {
                    orders: [order],
                    totalSpent: order.totalPrice,
                });
            }
        }

        if (byCustomer.size === 0) return 0;

        // Batch read existing docs
        const customerIds = Array.from(byCustomer.keys());
        const docIds = customerIds.map(cid => buildEcommerceCustomerId(clientId, platform, cid));

        // Firestore getAll supports up to 500 refs per call
        const chunks: string[][] = [];
        for (let i = 0; i < docIds.length; i += 500) {
            chunks.push(docIds.slice(i, i + 500));
        }

        const existingMap = new Map<string, EcommerceCustomer>();
        for (const chunk of chunks) {
            const refs = chunk.map(id => db.collection(COLLECTION).doc(id));
            const snapshots = await db.getAll(...refs);
            for (const snap of snapshots) {
                if (snap.exists) {
                    existingMap.set(snap.id, snap.data() as EcommerceCustomer);
                }
            }
        }

        // Batch write updates
        const now = new Date().toISOString();
        const batches: FirebaseFirestore.WriteBatch[] = [];
        let currentBatch = db.batch();
        let opCount = 0;

        for (const [customerId, data] of byCustomer) {
            const docId = buildEcommerceCustomerId(clientId, platform, customerId);
            const existing = existingMap.get(docId);

            const orderDates = data.orders.map(o => o.date).sort();
            const earliestDate = orderDates[0];
            const latestDate = orderDates[orderDates.length - 1];
            const email = data.orders.find(o => o.email)?.email;

            if (existing) {
                // Merge with existing
                const newOrderCount = existing.orderCount + data.orders.length;
                const newTotalSpent = existing.totalSpent + data.totalSpent;
                const update: Partial<EcommerceCustomer> = {
                    orderCount: newOrderCount,
                    totalSpent: newTotalSpent,
                    avgOrderValue: newTotalSpent / newOrderCount,
                    lastOrderDate: latestDate > existing.lastOrderDate ? latestDate : existing.lastOrderDate,
                    firstOrderDate: earliestDate < existing.firstOrderDate ? earliestDate : existing.firstOrderDate,
                    updatedAt: now,
                };
                if (email && !existing.email) update.email = email;
                currentBatch.update(db.collection(COLLECTION).doc(docId), update);
            } else {
                // New customer
                const doc: EcommerceCustomer = {
                    clientId,
                    platform,
                    customerId,
                    email,
                    firstOrderDate: earliestDate,
                    lastOrderDate: latestDate,
                    orderCount: data.orders.length,
                    totalSpent: data.totalSpent,
                    avgOrderValue: data.totalSpent / data.orders.length,
                    createdAt: now,
                    updatedAt: now,
                };
                currentBatch.set(db.collection(COLLECTION).doc(docId), doc);
            }

            opCount++;
            if (opCount >= 500) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                opCount = 0;
            }
        }
        if (opCount > 0) batches.push(currentBatch);

        for (const batch of batches) {
            await batch.commit();
        }

        console.log(`[EcommerceCustomer] Upserted ${byCustomer.size} customers for ${clientId} (${platform})`);
        return byCustomer.size;
    }

    /**
     * Compute customer intelligence from the ecommerce_customers collection.
     * Returns aggregated stats: LTV, cohorts, retention, avg days between orders.
     */
    static async computeCustomerIntelligence(
        clientId: string,
        periodRevenue?: number,
        periodUniqueCustomers?: number
    ): Promise<CustomerIntelligence> {
        const snapshot = await db.collection(COLLECTION)
            .where("clientId", "==", clientId)
            .get();

        const customers = snapshot.docs.map(d => d.data() as EcommerceCustomer);

        if (customers.length === 0) {
            return this.emptyIntelligence();
        }

        // Aggregate totals
        let totalSpent = 0;
        let totalOrders = 0;
        const cohorts: Record<string, { customers: EcommerceCustomer[] }> = {
            firstTime: { customers: [] },
            returning: { customers: [] },
            vip: { customers: [] },
        };

        for (const c of customers) {
            totalSpent += c.totalSpent;
            totalOrders += c.orderCount;
            const tier = getCohortTier(c.orderCount);
            cohorts[tier].customers.push(c);
        }

        const buildCohortStats = (custs: EcommerceCustomer[]): CohortStats => {
            if (custs.length === 0) return { count: 0, revenue: 0, avgLtv: 0, avgOrders: 0 };
            const totalRev = custs.reduce((s, c) => s + c.totalSpent, 0);
            const totalOrd = custs.reduce((s, c) => s + c.orderCount, 0);
            return {
                count: custs.length,
                revenue: totalRev,
                avgLtv: totalRev / custs.length,
                avgOrders: totalOrd / custs.length,
            };
        };

        // Avg days between orders for returning+vip customers
        const multiOrderCustomers = customers.filter(c => c.orderCount >= 2);
        let avgDaysBetweenOrders: number | undefined;
        if (multiOrderCustomers.length > 0) {
            let totalDaysSpan = 0;
            let totalGaps = 0;
            for (const c of multiOrderCustomers) {
                const first = new Date(c.firstOrderDate).getTime();
                const last = new Date(c.lastOrderDate).getTime();
                const daySpan = (last - first) / (1000 * 60 * 60 * 24);
                if (daySpan > 0 && c.orderCount > 1) {
                    totalDaysSpan += daySpan / (c.orderCount - 1);
                    totalGaps++;
                }
            }
            if (totalGaps > 0) {
                avgDaysBetweenOrders = Math.round(totalDaysSpan / totalGaps);
            }
        }

        return {
            totalTrackedCustomers: customers.length,
            avgLifetimeLtv: totalSpent / customers.length,
            avgLifetimeOrders: totalOrders / customers.length,
            revenuePerCustomer: periodRevenue && periodUniqueCustomers
                ? periodRevenue / periodUniqueCustomers
                : totalSpent / customers.length,
            cohorts: {
                firstTime: buildCohortStats(cohorts.firstTime.customers),
                returning: buildCohortStats(cohorts.returning.customers),
                vip: buildCohortStats(cohorts.vip.customers),
            },
            avgDaysBetweenOrders,
        };
    }

    /**
     * Compute retention rate: % of customers from previous period who also ordered in current period.
     */
    static async computeRetention(
        clientId: string,
        currentStart: string,
        currentEnd: string,
        prevStart: string,
        prevEnd: string
    ): Promise<number | undefined> {
        // Get customers who ordered in previous period
        const prevSnap = await db.collection(COLLECTION)
            .where("clientId", "==", clientId)
            .where("lastOrderDate", ">=", prevStart)
            .where("lastOrderDate", "<=", prevEnd)
            .get();

        if (prevSnap.empty) return undefined;

        const prevCustomerIds = new Set(
            prevSnap.docs.map(d => (d.data() as EcommerceCustomer).customerId)
        );

        // Get customers who ordered in current period
        const currSnap = await db.collection(COLLECTION)
            .where("clientId", "==", clientId)
            .where("lastOrderDate", ">=", currentStart)
            .where("lastOrderDate", "<=", currentEnd)
            .get();

        const retained = currSnap.docs.filter(d =>
            prevCustomerIds.has((d.data() as EcommerceCustomer).customerId)
        ).length;

        return prevCustomerIds.size > 0
            ? (retained / prevCustomerIds.size) * 100
            : undefined;
    }

    /**
     * Compute LTV:CAC ratio using ad spend from META + GOOGLE channel_snapshots.
     */
    static async computeLtvCac(
        clientId: string,
        startDate: string,
        endDate: string,
        avgLtv: number,
        newCustomers: number
    ): Promise<CustomerIntelligence['ltvCac'] | undefined> {
        if (newCustomers <= 0 || avgLtv <= 0) return undefined;

        // Read META + GOOGLE channel_snapshots for the period
        let totalAdSpend = 0;
        for (const channel of ['META', 'GOOGLE'] as const) {
            const snap = await db.collection("channel_snapshots")
                .where("clientId", "==", clientId)
                .where("channel", "==", channel)
                .where("date", ">=", startDate)
                .where("date", "<=", endDate)
                .get();

            for (const doc of snap.docs) {
                const data = doc.data();
                totalAdSpend += data.metrics?.spend || 0;
            }
        }

        if (totalAdSpend <= 0) return undefined;

        const cac = totalAdSpend / newCustomers;
        return {
            cac,
            ltvCacRatio: avgLtv / cac,
            adSpend: totalAdSpend,
            newCustomers,
        };
    }

    private static emptyIntelligence(): CustomerIntelligence {
        const emptyCohort: CohortStats = { count: 0, revenue: 0, avgLtv: 0, avgOrders: 0 };
        return {
            totalTrackedCustomers: 0,
            avgLifetimeLtv: 0,
            avgLifetimeOrders: 0,
            revenuePerCustomer: 0,
            cohorts: {
                firstTime: { ...emptyCohort },
                returning: { ...emptyCohort },
                vip: { ...emptyCohort },
            },
        };
    }
}
