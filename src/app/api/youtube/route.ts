import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const videos = await prisma.youTubeVideo.findMany({
    include: {
      scrapeJob: {
        select: { id: true, status: true, progress: true, currentStep: true, engagersFound: true, draftsGenerated: true },
      },
      _count: { select: { engagements: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(videos)
}
