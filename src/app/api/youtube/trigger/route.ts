import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  const { videoUrls } = await req.json()

  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return NextResponse.json({ error: "videoUrls array required" }, { status: 400 })
  }

  if (!process.env.BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET) {
    return NextResponse.json(
      { error: "BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET not configured" },
      { status: 400 }
    )
  }

  const created: { videoId: string; jobId: string }[] = []

  for (const rawUrl of videoUrls) {
    const url = rawUrl.trim()
    if (!url) continue

    const videoId = extractVideoId(url)
    if (!videoId) continue

    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Find or create the video
    let video = await prisma.youTubeVideo.findUnique({
      where: { videoId },
      include: { scrapeJob: true },
    })

    if (!video) {
      video = await prisma.youTubeVideo.create({
        data: { url: normalizedUrl, videoId },
        include: { scrapeJob: true },
      })
    }

    // Skip if already has an active job
    if (video.scrapeJob && ["queued", "running"].includes(video.scrapeJob.status)) {
      continue
    }

    // Delete old job if exists (re-scrape)
    if (video.scrapeJob) {
      await prisma.youTubeScrapeJob.delete({ where: { id: video.scrapeJob.id } })
    }

    // Create new scrape job
    const job = await prisma.youTubeScrapeJob.create({
      data: {
        youtubeVideoId: video.id,
        status: "queued",
      },
    })

    created.push({ videoId: video.id, jobId: job.id })
  }

  // Kick off worker
  if (created.length > 0) {
    const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/youtube/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})
  }

  return NextResponse.json({ triggered: created.length, jobs: created })
}
