import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runYouTubeScrapeJob } from "@/lib/scrape/youtube-engine"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get("x-internal-key")
  if (
    process.env.INTERNAL_API_KEY &&
    internalKey !== process.env.INTERNAL_API_KEY
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Recover stale jobs
  await prisma.youTubeScrapeJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    data: { status: "queued", currentStep: "Resumed after timeout" },
  })

  // Claim next queued job
  const job = await prisma.youTubeScrapeJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  })

  if (!job) {
    return NextResponse.json({ message: "No YouTube jobs queued" })
  }

  await prisma.youTubeScrapeJob.update({
    where: { id: job.id },
    data: { status: "running", startedAt: new Date() },
  })

  try {
    await runYouTubeScrapeJob(job.id)
  } catch (error) {
    console.error(`YouTube scrape job ${job.id} failed:`, error)
    await prisma.youTubeScrapeJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: String(error),
        completedAt: new Date(),
      },
    })
  }

  // Self-chain
  const nextJob = await prisma.youTubeScrapeJob.findFirst({
    where: { status: "queued" },
  })

  if (nextJob) {
    const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/youtube/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})
  }

  return NextResponse.json({ processed: job.id })
}
