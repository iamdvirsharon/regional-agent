import { NextRequest, NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { runScrapeJob, runQuickScrapeJob } from "@/lib/scrape/engine"

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

  // Cancel stale queued jobs older than 1 hour (likely orphaned)
  await prisma.scrapeJob.updateMany({
    where: {
      status: "queued",
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    data: { status: "failed", errorMessage: "Cancelled: stale queued job", completedAt: new Date() },
  })

  // Claim the next queued job
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
    data: { status: "running", startedAt: new Date(), currentStep: "Starting..." },
  })

  // Process the job in the background
  after(async () => {
    try {
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
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })
    }
  })

  return NextResponse.json({ processed: job.id })
}
