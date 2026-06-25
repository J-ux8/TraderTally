const CACHE_TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 10;

interface CacheEntry {
  transactions: any[];
  stats: any;
  timestamp: number;
  version: number;
}

let cache = new Map<string, CacheEntry>();
let currentVersion = 0;

export function invalidateStatsCache() {
  currentVersion++;
}

export function clearStatsCache() {
  cache.clear();
}

function evictOldest() {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function getCachedStats(key: string): { transactions: any[]; stats: any } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.version !== currentVersion) {
    cache.delete(key);
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return { transactions: entry.transactions, stats: entry.stats };
}

export function setCachedStats(key: string, transactions: any[], stats: any) {
  if (cache.size >= MAX_ENTRIES) {
    evictOldest();
  }
  cache.set(key, {
    transactions,
    stats,
    timestamp: Date.now(),
    version: currentVersion,
  });
}
