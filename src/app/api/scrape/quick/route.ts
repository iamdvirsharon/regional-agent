import { NextRequest, NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { runQuickScrapeJob } from "@/lib/scrape/engine"

export const maxDuration = 60 // Vercel Hobby plan max

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
  if (
    !trimmed.includes("linkedin.com/") ||
    (!trimmed.includes("/posts/") &&
      !trimmed.includes("/pulse/") &&
      !trimmed.includes("activity"))
  ) {
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

  // Create a scrape job — start as "running" immediately
  const job = await prisma.scrapeJob.create({
    data: {
      postUrl: trimmed,
      status: "running",
      startedAt: new Date(),
      currentStep: "Starting up — connecting to Bright Data...",
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

  // Run the scrape in the background using after()
  // The response returns immediately, but the function stays alive to process the job
  after(async () => {
    try {
      await runQuickScrapeJob(job.id)
    } catch (error) {
      console.error(`Quick scrape job ${job.id} failed:`, error)
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

  return NextResponse.json({ jobId: job.id, status: "running" })
}

/**
 * DELETE — reset a previously scraped post so it can be re-scraped
 */
export async function DELETE(req: NextRequest) {
  const postUrl = req.nextUrl.searchParams.get("postUrl")
  if (!postUrl) {
    return NextResponse.json({ error: "postUrl query param is required" }, { status: 400 })
  }

  const postUrn = `quick:${postUrl}`

  // Delete engagements, drafts, and the scraped post
  const post = await prisma.scrapedPost.findUnique({ where: { postUrn } })
  if (post) {
    // Delete drafts linked through engagements on this post
    await prisma.outreachDraft.deleteMany({
      where: { engagement: { scrapedPostId: post.id } },
    })
    // Delete engagements
    await prisma.engagement.deleteMany({
      where: { scrapedPostId: post.id },
    })
    // Delete the scraped post
    await prisma.scrapedPost.delete({ where: { id: post.id } })
  }

  return NextResponse.json({ success: true, deleted: !!post })
}
