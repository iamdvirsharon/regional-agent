import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const country = searchParams.get("country")
  const channel = searchParams.get("channel")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")

  const where: Prisma.OutreachDraftWhereInput = {}

  if (status) {
    where.status = status
  }

  if (channel) {
    where.channel = channel
  }

  if (country) {
    where.engager = { country }
  }

  if (search) {
    where.OR = [
      { engager: { name: { contains: search } } },
      { engager: { currentCompany: { contains: search } } },
      { engager: { country: { contains: search } } },
      { engager: { currentTitle: { contains: search } } },
    ]
  }

  const [drafts, total] = await Promise.all([
    prisma.outreachDraft.findMany({
      where,
      include: {
        engager: {
          select: {
            name: true, currentTitle: true, currentCompany: true,
            country: true, linkedinUrl: true, email: true, leadScore: true, source: true,
          },
        },
        engagement: {
          select: {
            type: true,
            commentText: true,
            source: true,
            scrapedPost: {
              select: { postText: true, linkedinPostUrl: true, employeeProfile: { select: { name: true } } },
            },
            youtubeVideo: {
              select: { title: true, url: true },
            },
          },
        },
      },
      orderBy: [
        { engager: { leadScore: "desc" } },
        { generatedAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outreachDraft.count({ where }),
  ])

  return NextResponse.json({
    drafts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
