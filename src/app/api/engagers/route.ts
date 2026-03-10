import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get("country")
  const enriched = searchParams.get("enriched")
  const source = searchParams.get("source")
  const since = searchParams.get("since")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const where: Record<string, unknown> = {}

  if (country) {
    where.country = country
  }

  if (enriched === "true") {
    where.profileEnriched = true
  } else if (enriched === "false") {
    where.profileEnriched = false
  }

  if (source) {
    where.source = source
  }

  if (since) {
    where.createdAt = { gte: new Date(since) }
  }

  const [engagers, total] = await Promise.all([
    prisma.engager.findMany({
      where,
      include: {
        engagements: {
          include: {
            scrapedPost: {
              select: { linkedinPostUrl: true, postText: true, employeeProfile: { select: { name: true } } },
            },
            youtubeVideo: {
              select: { title: true, url: true },
            },
          },
          orderBy: { detectedAt: "desc" },
          take: 3,
        },
        outreachDrafts: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          select: { id: true, icebreaker: true, status: true, channel: true },
        },
      },
      orderBy: { leadScore: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.engager.count({ where }),
  ])

  // Get distinct countries for filter dropdown
  const countries = await prisma.engager.groupBy({
    by: ["country"],
    _count: { country: true },
    where: { country: { not: null } },
    orderBy: { _count: { country: "desc" } },
  })

  return NextResponse.json({
    engagers,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    countries: countries.map((c) => ({
      country: c.country,
      count: c._count.country,
    })),
  })
}
