/**
 * Ecommerce Customers — Individual customer tracking across platforms
 *
 * Collection: `ecommerce_customers`
 * Document ID: `{clientId}__{platform}__{customerId}`
 *
 * Updated on every ecommerce sync. Enables:
 * - True lifetime LTV for all platforms (not just Shopify)
 * - 3-tier cohort analysis (firstTime / returning / VIP)
 * - Retention rate computation
 * - LTV:CAC ratio (cross-channel with ad spend)
 */

export type EcommercePlatform = 'shopify' | 'tiendanube' | 'woocommerce';

export interface EcommerceCustomer {
    clientId: string;
    platform: EcommercePlatform;
    customerId: string;
    email?: string;
    firstOrderDate: string;       // YYYY-MM-DD
    lastOrderDate: string;        // YYYY-MM-DD
    orderCount: number;
    totalSpent: number;
    avgOrderValue: number;        // totalSpent / orderCount
    createdAt: string;            // ISO 8601
    updatedAt: string;            // ISO 8601
}

export function buildEcommerceCustomerId(
    clientId: string,
    platform: EcommercePlatform,
    customerId: string
): string {
    return `${clientId}__${platform}__${customerId}`;
}

/** Cohort tier based on lifetime order count */
export type CohortTier = 'firstTime' | 'returning' | 'vip';

export function getCohortTier(orderCount: number): CohortTier {
    if (orderCount <= 1) return 'firstTime';
    if (orderCount <= 5) return 'returning';
    return 'vip';
}

export interface CohortStats {
    count: number;
    revenue: number;
    avgLtv: number;
    avgOrders: number;
}

export interface CustomerIntelligence {
    totalTrackedCustomers: number;
    avgLifetimeLtv: number;
    avgLifetimeOrders: number;
    revenuePerCustomer: number;
    cohorts: {
        firstTime: CohortStats;
        returning: CohortStats;
        vip: CohortStats;
    };
    retentionRate?: number;
    avgDaysBetweenOrders?: number;
    ltvCac?: {
        cac: number;
        ltvCacRatio: number;
        adSpend: number;
        newCustomers: number;
    };
}
