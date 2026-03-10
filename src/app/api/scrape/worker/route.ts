import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runScrapeJob } from "@/lib/scrape/engine"

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
    await runScrapeJob(job.id)
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
    const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/scrape/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})
  }

  return NextResponse.json({ processed: job.id })
}
