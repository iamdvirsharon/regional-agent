import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const video = await prisma.youTubeVideo.findUnique({
    where: { id },
    include: {
      scrapeJob: true,
      engagements: {
        include: { engager: true },
        orderBy: { detectedAt: "desc" },
        take: 100,
      },
    },
  })

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 })
  }

  return NextResponse.json(video)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.youTubeVideo.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
