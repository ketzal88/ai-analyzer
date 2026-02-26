/**
 * Brain Prompt Service — Worker Brain V2
 *
 * Manages Brain Prompts stored in Firestore.
 *
 * Purpose:
 * - Fetch prompts from brain_prompts/{brainId} collection
 * - Cache prompts in memory (5-minute TTL)
 * - Provide alert rules for Channel Brains to evaluate
 *
 * Why Prompts in Firestore?
 * - Iterate alert logic WITHOUT code deploy
 * - Version control via updatedAt timestamp
 * - A/B testing different prompt versions
 * - Cerebro UI can edit prompts directly
 *
 * Usage:
 * ```typescript
 * const prompt = await BrainPromptService.getBrainPrompt('META');
 * console.log(prompt.systemPrompt);
 *
 * const rules = await BrainPromptService.getAlertRules('META');
 * for (const rule of rules) {
 *   if (meetsCondition(rule, data)) {
 *     generateAlert(rule);
 *   }
 * }
 * ```
 */

import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Alert rule stored in brain prompt
 */
export interface AlertRule {
  /** Rule ID (e.g., "META_HIGH_FREQUENCY") */
  id: string;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Human-readable condition description */
  condition: string;
  /** Numeric threshold value */
  threshold: number;
  /** Alert severity */
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  /** Message template with {placeholders} */
  messageTemplate: string;
  /** Actionable recommendation */
  recommendation: string;
}

/**
 * Brain prompt stored in Firestore
 */
export interface BrainPrompt {
  /** Brain ID (META, GOOGLE, GA4, ECOMMERCE, MASTER) */
  brainId: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'MASTER';
  /** Semantic version (e.g., "1.0.0", "1.1.0") */
  version: string;
  /** Last update timestamp */
  updatedAt: Timestamp | string;
  /** System prompt (role and principles) */
  systemPrompt: string;
  /** Analysis prompt template with {placeholders} */
  analysisPrompt: string;
  /** Alert rules (JSON array) */
  alertRules: AlertRule[];
}

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  prompt: BrainPrompt;
  fetchedAt: number;
}

/**
 * Brain Prompt Service (Singleton)
 *
 * Fetches and caches brain prompts from Firestore.
 */
export class BrainPromptService {
  private static cache = new Map<string, CacheEntry>();
  private static cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get brain prompt from Firestore (with 5-min cache)
   *
   * @param brainId - Brain identifier (META, GOOGLE, etc.)
   * @returns BrainPrompt or null if not found
   *
   * @example
   * const prompt = await BrainPromptService.getBrainPrompt('META');
   * console.log(prompt.version);  // "1.0.0"
   */
  static async getBrainPrompt(brainId: string): Promise<BrainPrompt | null> {
    // Check cache
    const cached = this.cache.get(brainId);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.prompt;
    }

    // Fetch from Firestore
    try {
      const doc = await db.collection("brain_prompts").doc(brainId).get();

      if (!doc.exists) {
        console.warn(`[BrainPromptService] Brain prompt not found: ${brainId}`);
        return null;
      }

      const prompt = doc.data() as BrainPrompt;

      // Cache for 5 minutes
      this.cache.set(brainId, {
        prompt,
        fetchedAt: Date.now()
      });

      return prompt;
    } catch (error) {
      console.error(`[BrainPromptService] Error fetching prompt for ${brainId}:`, error);
      return null;
    }
  }

  /**
   * Get alert rules for a brain (only enabled rules)
   *
   * @param brainId - Brain identifier
   * @returns Array of enabled AlertRule objects
   *
   * @example
   * const rules = await BrainPromptService.getAlertRules('META');
   * console.log(rules.length);  // 4 (HIGH_FREQUENCY, LOW_ROAS, etc.)
   */
  static async getAlertRules(brainId: string): Promise<AlertRule[]> {
    const prompt = await this.getBrainPrompt(brainId);
    if (!prompt) return [];

    // Filter to only enabled rules
    return prompt.alertRules.filter(r => r.enabled);
  }

  /**
   * Get a specific alert rule by ID
   *
   * @param brainId - Brain identifier
   * @param ruleId - Rule ID (e.g., "META_HIGH_FREQUENCY")
   * @returns AlertRule or null if not found
   *
   * @example
   * const rule = await BrainPromptService.getAlertRule('META', 'META_HIGH_FREQUENCY');
   * console.log(rule?.threshold);  // 3.5
   */
  static async getAlertRule(brainId: string, ruleId: string): Promise<AlertRule | null> {
    const rules = await this.getAlertRules(brainId);
    return rules.find(r => r.id === ruleId) || null;
  }

  /**
   * Interpolate message template with values
   *
   * Replaces {placeholders} in template with actual values.
   *
   * @param template - Template string with {placeholders}
   * @param values - Object with placeholder values
   * @returns Interpolated string
   *
   * @example
   * const msg = BrainPromptService.interpolateTemplate(
   *   "Frecuencia {value}x supera umbral {threshold}x",
   *   { value: 4.2, threshold: 3.5 }
   * );
   * // "Frecuencia 4.2x supera umbral 3.5x"
   */
  static interpolateTemplate(template: string, values: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }

    return result;
  }

  /**
   * Clear cache for a specific brain or all brains
   *
   * @param brainId - Optional brain ID to clear. If not provided, clears all.
   *
   * @example
   * BrainPromptService.clearCache('META');  // Clear Meta cache
   * BrainPromptService.clearCache();        // Clear all cache
   */
  static clearCache(brainId?: string): void {
    if (brainId) {
      this.cache.delete(brainId);
      console.log(`[BrainPromptService] Cleared cache for ${brainId}`);
    } else {
      this.cache.clear();
      console.log(`[BrainPromptService] Cleared all cache`);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private static isCacheExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.fetchedAt;
    return age > this.cacheTTL;
  }

  /**
   * Get cache statistics (for debugging)
   */
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
