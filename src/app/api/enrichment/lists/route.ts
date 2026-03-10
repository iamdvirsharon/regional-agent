import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_PROVIDERS = ["apollo", "zoominfo", "leadiq"]

export async function GET() {
  const lists = await prisma.enrichmentList.findMany({
    include: {
      _count: { select: { engagers: true } },
      engagers: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = lists.map((list) => {
    const statusCounts = {
      pending: list.engagers.filter((e) => e.status === "pending").length,
      enriched: list.engagers.filter((e) => e.status === "enriched").length,
      failed: list.engagers.filter((e) => e.status === "failed").length,
      not_found: list.engagers.filter((e) => e.status === "not_found").length,
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { engagers: _, ...rest } = list
    return { ...rest, statusCounts }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { name, engagerIds, provider = "apollo" } = await req.json()

  if (!name || !engagerIds?.length) {
    return NextResponse.json({ error: "name and engagerIds required" }, { status: 400 })
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` }, { status: 400 })
  }

  const list = await prisma.enrichmentList.create({
    data: {
      name,
      provider,
      totalCount: engagerIds.length,
      engagers: {
        create: engagerIds.map((engagerId: string) => ({
          engagerId,
          status: "pending",
        })),
      },
    },
    include: { _count: { select: { engagers: true } } },
  })

  return NextResponse.json(list, { status: 201 })
}
