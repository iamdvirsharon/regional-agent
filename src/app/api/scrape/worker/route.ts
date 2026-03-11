import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runScrapeJob, runQuickScrapeJob } from "@/lib/scrape/engine"
import { getBaseUrl } from "@/lib/url"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Internal key check
  const internalKey = req.headers.get("x-internal-key")
  if (
    process.env.INTERNAL_API_KEY &&
    internalKey !== process.env.INTERNAL_API_KEY
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Recover stale jobs: reset any "running" job older than 10 minutes
  await prisma.scrapeJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    data: { status: "queued", currentStep: "Resumed after timeout" },
  })

  // Cancel stale queued jobs older than 1 hour (likely orphaned)
  await prisma.scrapeJob.updateMany({
    where: {
      status: "queued",
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    data: { status: "failed", errorMessage: "Cancelled: stale queued job", completedAt: new Date() },
  })

  // Atomically claim the next queued job
  const job = await prisma.scrapeJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  })

  if (!job) {
    return NextResponse.json({ message: "No jobs queued" })
  }

  // Mark as running
  await prisma.scrapeJob.update({
    where: { id: job.id },
    data: { status: "running", startedAt: new Date() },
  })

  try {
    // Route quick scrape jobs (no company, has postUrl) to dedicated handler
    if (!job.companyId && job.postUrl) {
      await runQuickScrapeJob(job.id)
    } else {
      await runScrapeJob(job.id)
    }
  } catch (error) {
    console.error(`Scrape job ${job.id} failed:`, error)

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: String(error),
        completedAt: new Date(),
      },
    })
  }

  // Self-chain: check for more queued jobs
  const nextJob = await prisma.scrapeJob.findFirst({
    where: { status: "queued" },
  })

  if (nextJob) {
    const workerUrl = `${getBaseUrl()}/api/scrape/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})
  }

  return NextResponse.json({ processed: job.id })
}
