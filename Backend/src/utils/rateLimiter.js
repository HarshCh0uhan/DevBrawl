const buckets = new Map()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

export const isRateLimited = (userId, max = MAX_REQUESTS) => {
  const now = Date.now()
  const recent = (buckets.get(userId) || []).filter((t) => now - t < WINDOW_MS)
  buckets.set(userId, recent)
  if (recent.length >= max) return true
  recent.push(now)
  return false
}

// Periodic cleanup prevents unbounded Map growth.
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of buckets) {
    if (timestamps.every((timestamp) => now - timestamp >= WINDOW_MS)) {
      buckets.delete(key)
    }
  }
}, WINDOW_MS).unref()
