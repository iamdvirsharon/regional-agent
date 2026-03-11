import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateConfigCache } from "@/lib/config"

// All known API keys grouped by category
const API_KEY_DEFINITIONS = [
  {
    group: "Scraping",
    keys: [
      { key: "BRIGHT_DATA_API_KEY", label: "Bright Data API Key", description: "Required for LinkedIn scraping" },
      { key: "BRIGHT_DATA_LIKERS_DATASET", label: "Likers Dataset ID", description: "Optional — enables post liker collection" },
      { key: "BRIGHT_DATA_COMPANY_DATASET", label: "Company Dataset ID", description: "Optional — enables auto-discover employees" },
      { key: "BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET", label: "YouTube Comments Dataset ID", description: "Required for YouTube comment scraping" },
    ],
  },
  {
    group: "AI",
    keys: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", description: "Required for AI draft generation" },
    ],
  },
  {
    group: "Enrichment",
    keys: [
      { key: "APOLLO_API_KEY", label: "Apollo.io API Key", description: "Apollo people enrichment" },
      { key: "ZOOMINFO_CLIENT_ID", label: "ZoomInfo Client ID", description: "ZoomInfo enrichment (client ID)" },
      { key: "ZOOMINFO_PRIVATE_KEY", label: "ZoomInfo Private Key", description: "ZoomInfo enrichment (private key)" },
      { key: "LEADIQ_API_KEY", label: "LeadIQ API Key", description: "LeadIQ people enrichment" },
    ],
  },
  {
    group: "Export",
    keys: [
      { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", label: "Google Service Account Email", description: "Required for Sheets export" },
      { key: "GOOGLE_SERVICE_ACCOUNT_KEY", label: "Google Service Account Key", description: "Required for Sheets export" },
      { key: "GOOGLE_SHEET_ID", label: "Google Sheet ID", description: "Target spreadsheet for BDR delivery" },
    ],
  },
]

/**
 * GET — return all keys with their configured status and masked values
 */
export async function GET() {
  // Fetch all saved keys from DB
  const dbKeys = await prisma.apiKey.findMany()
  const dbMap = new Map(dbKeys.map((k) => [k.key, k.value]))

  const groups = API_KEY_DEFINITIONS.map((group) => ({
    group: group.group,
    keys: group.keys.map((def) => {
      const dbValue = dbMap.get(def.key)
      const envValue = process.env[def.key]
      const hasValue = !!(dbValue || envValue)
      const source = dbValue ? "database" : envValue ? "environment" : null

      return {
        key: def.key,
        label: def.label,
        description: def.description,
        configured: hasValue,
        source,
        // Mask the value — show only last 4 chars
        maskedValue: hasValue
          ? "••••••••" + (dbValue || envValue || "").slice(-4)
          : null,
      }
    }),
  }))

  return NextResponse.json({ groups })
}

/**
 * POST — upsert an API key value
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { key, value } = body as { key: string; value: string }

  if (!key || !value) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 })
  }

  // Verify it's a known key
  const allKeys = API_KEY_DEFINITIONS.flatMap((g) => g.keys.map((k) => k.key))
  if (!allKeys.includes(key)) {
    return NextResponse.json({ error: "Unknown API key" }, { status: 400 })
  }

  await prisma.apiKey.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })

  invalidateConfigCache(key)

  return NextResponse.json({ success: true })
}

/**
 * DELETE — remove an API key from the database (reverts to env fallback)
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 })
  }

  try {
    await prisma.apiKey.delete({ where: { key } })
  } catch {
    // Key didn't exist — that's fine
  }

  invalidateConfigCache(key)

  return NextResponse.json({ success: true })
}
