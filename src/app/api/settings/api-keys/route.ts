import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateConfigCache } from "@/lib/config"

// All known API keys grouped by category
const API_KEY_DEFINITIONS = [
  {
    group: "Required",
    keys: [
      { key: "BRIGHT_DATA_API_KEY", label: "Bright Data API Key", description: "Powers all LinkedIn scraping — get yours at brightdata.com" },
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", description: "Powers AI outreach draft generation — get yours at console.anthropic.com" },
    ],
  },
  {
    group: "Enrichment (Optional)",
    keys: [
      { key: "APOLLO_API_KEY", label: "Apollo.io API Key", description: "Find emails and company info for engagers" },
      { key: "LEADIQ_API_KEY", label: "LeadIQ API Key", description: "Alternative email enrichment provider" },
      { key: "ZOOMINFO_CLIENT_ID", label: "ZoomInfo Client ID", description: "Enterprise enrichment (client ID)" },
      { key: "ZOOMINFO_PRIVATE_KEY", label: "ZoomInfo Private Key", description: "Enterprise enrichment (private key)" },
    ],
  },
  {
    group: "Google Sheets (Optional)",
    keys: [
      { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", label: "Service Account Email", description: "For auto-export to Google Sheets" },
      { key: "GOOGLE_SERVICE_ACCOUNT_KEY", label: "Service Account Key", description: "JSON private key for the service account" },
      { key: "GOOGLE_SHEET_ID", label: "Google Sheet ID", description: "Target spreadsheet ID" },
    ],
  },
  {
    group: "Advanced (Optional)",
    keys: [
      { key: "BRIGHT_DATA_LIKERS_DATASET", label: "Likers Dataset ID", description: "Custom Bright Data dataset for post likers — leave blank to skip likers" },
      { key: "BRIGHT_DATA_COMPANY_DATASET", label: "Company Dataset ID", description: "Custom Bright Data dataset for company employee discovery" },
      { key: "BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET", label: "YouTube Comments Dataset ID", description: "Custom Bright Data dataset for YouTube comment scraping" },
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
