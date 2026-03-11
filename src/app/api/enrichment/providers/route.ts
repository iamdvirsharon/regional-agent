import { NextResponse } from "next/server"
import { hasConfigValue } from "@/lib/config"

export async function GET() {
  const [apollo, zoomClientId, zoomKey, leadiq] = await Promise.all([
    hasConfigValue("APOLLO_API_KEY"),
    hasConfigValue("ZOOMINFO_CLIENT_ID"),
    hasConfigValue("ZOOMINFO_PRIVATE_KEY"),
    hasConfigValue("LEADIQ_API_KEY"),
  ])

  const providers = [
    { id: "apollo", name: "Apollo.io", configured: apollo },
    { id: "zoominfo", name: "ZoomInfo", configured: zoomClientId && zoomKey },
    { id: "leadiq", name: "LeadIQ", configured: leadiq },
  ]

  return NextResponse.json({ providers })
}
