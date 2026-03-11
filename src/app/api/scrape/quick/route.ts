import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBaseUrl } from "@/lib/url"

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 })
  }

  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } })
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    engagersFound: job.engagersFound,
    draftsGenerated: job.draftsGenerated,
    errorMessage: job.errorMessage,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { postUrl } = body

  if (!postUrl || typeof postUrl !== "string") {
    return NextResponse.json({ error: "postUrl is required" }, { status: 400 })
  }

  // Basic LinkedIn post URL validation
  const trimmed = postUrl.trim()
  if (!trimmed.includes("linkedin.com/") || !trimmed.includes("/posts/") && !trimmed.includes("/pulse/") && !trimmed.includes("activity")) {
    return NextResponse.json(
      { error: "Please provide a valid LinkedIn post URL (e.g., https://www.linkedin.com/posts/...)" },
      { status: 400 }
    )
  }

  // Use the URL as a pseudo-URN for uniqueness
  const postUrn = `quick:${trimmed}`

  // Check if this post was already scraped
  const existingPost = await prisma.scrapedPost.findUnique({
    where: { postUrn },
  })

  if (existingPost?.engagementsCollected) {
    return NextResponse.json(
      { error: "This post has already been scraped. Check the Engagers page for results." },
      { status: 409 }
    )
  }

  // Create a scrape job (no company)
  const job = await prisma.scrapeJob.create({
    data: {
      postUrl: trimmed,
    },
  })

  // Create the ScrapedPost record (no employee profile)
  if (!existingPost) {
    await prisma.scrapedPost.create({
      data: {
        employeeProfileId: null,
        linkedinPostUrl: trimmed,
        postUrn,
        postText: "(Quick scrape — post text will be populated after scraping)",
      },
    })
  }

  // Kick off the worker
  const workerUrl = `${getBaseUrl()}/api/scrape/worker`
  fetch(workerUrl, {
    method: "POST",
    headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
  }).catch(() => {})

  return NextResponse.json({ jobId: job.id, status: "queued" })
}
