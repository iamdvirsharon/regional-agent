// Centralized config helper: checks database ApiKey table first, falls back to process.env
// Uses a simple TTL cache to avoid hitting the database on every call

import { prisma } from "@/lib/prisma"

interface CacheEntry {
  value: string | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000 // 60 seconds

/**
 * Get a configuration value by key.
 * Priority: Database ApiKey table → process.env → null
 */
export async function getConfigValue(key: string): Promise<string | null> {
  // Check cache first
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value
  }

  // Check database
  try {
    const row = await prisma.apiKey.findUnique({ where: { key } })
    if (row?.value) {
      cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS })
      return row.value
    }
  } catch (error) {
    // Database might not be ready — fall through to env
    console.warn(`config.getConfigValue DB lookup failed for ${key}:`, error)
  }

  // Fallback to environment variable
  const envValue = process.env[key] || null
  cache.set(key, { value: envValue, expiresAt: Date.now() + CACHE_TTL_MS })
  return envValue
}

/**
 * Check if a config key has a value (DB or env).
 */
export async function hasConfigValue(key: string): Promise<boolean> {
  const val = await getConfigValue(key)
  return !!val
}

/**
 * Invalidate cache for a specific key (call after upsert/delete).
 */
export function invalidateConfigCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
