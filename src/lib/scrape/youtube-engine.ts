// YouTube comments scrape pipeline
// Scrapes comments from a video, creates engagers, scores, generates LinkedIn DM drafts

import { prisma } from "@/lib/prisma"
import { collectYouTubeComments } from "./brightdata"
import { generateOutreachDraft, type DraftContext } from "./claude"
import { calculateLeadScore } from "./scoring"

async function updateProgress(jobId: string, progress: number, step: string) {
  await prisma.youTubeScrapeJob.update({
    where: { id: jobId },
    data: { progress, currentStep: step },
  })
}

export async function runYouTubeScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.youTubeScrapeJob.findUnique({
    where: { id: jobId },
    include: { youtubeVideo: true },
  })

  if (!job) throw new Error(`YouTube job ${jobId} not found`)

  const video = job.youtubeVideo
  let totalEngagersFound = 0
  let totalDraftsGenerated = 0

  // ──────────────────────────────────────────────────
  // Step 1: Scrape comments from YouTube video
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 5, "Scraping YouTube comments")

  const comments = await collectYouTubeComments(video.url)

  await prisma.youTubeVideo.update({
    where: { id: video.id },
    data: {
      commentsCollected: true,
      totalComments: comments.length,
      scrapedAt: new Date(),
    },
  })

  await updateProgress(jobId, 25, `Found ${comments.length} comments`)

  // ──────────────────────────────────────────────────
  // Step 2: Create engagers + engagements from comments
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 30, "Creating engager profiles")

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i]
    if (!comment.userChannelUrl) continue

    await updateProgress(
      jobId,
      30 + Math.round((i / comments.length) * 25),
      `Processing commenter ${i + 1}/${comments.length}`
    )

    // Find or create engager by YouTube channel URL
    let engager = await prisma.engager.findFirst({
      where: { youtubeChannel: comment.userChannelUrl },
    })

    if (!engager) {
      engager = await prisma.engager.create({
        data: {
          name: comment.username,
          youtubeChannel: comment.userChannelUrl,
          source: "youtube",
          // No linkedinUrl — will be enriched via Apollo later
        },
      })
      totalEngagersFound++
    }

    // Create engagement
    try {
      await prisma.engagement.create({
        data: {
          engagerId: engager.id,
          youtubeVideoId: video.id,
          type: "comment",
          commentText: comment.commentText,
          source: "youtube",
        },
      })
    } catch {
      // Unique constraint violation — already exists
    }
  }

  // ──────────────────────────────────────────────────
  // Step 3: Score engagers
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 58, "Scoring leads")

  const icpConfig = await prisma.iCPConfig.findFirst({ where: { isActive: true } })
  const icpTargetTitles = icpConfig?.targetTitles ? JSON.parse(icpConfig.targetTitles) : []
  const icpExcludeTitles = icpConfig?.excludeTitles ? JSON.parse(icpConfig.excludeTitles) : []
  const icpExcludeCompanies = icpConfig?.excludeCompanies ? JSON.parse(icpConfig.excludeCompanies) : []

  const engagersToScore = await prisma.engager.findMany({
    where: {
      source: "youtube",
      leadScore: 0,
      engagements: { some: { youtubeVideoId: video.id } },
    },
    include: { engagements: true },
  })

  for (const engager of engagersToScore) {
    const bestEngagement = engager.engagements.find((e) => e.type === "comment") || engager.engagements[0]

    const result = calculateLeadScore({
      currentTitle: engager.currentTitle,
      currentCompany: engager.currentCompany,
      aboutText: engager.aboutText,
      engagementType: (bestEngagement?.type as "like" | "comment") || "comment",
      commentText: bestEngagement?.commentText || null,
      engagementCount: engager.engagements.length,
      icpTargetTitles,
      icpExcludeTitles,
      icpExcludeCompanies,
      source: "youtube",
    })

    await prisma.engager.update({
      where: { id: engager.id },
      data: {
        leadScore: result.score,
        scoreFactors: JSON.stringify(result.factors),
      },
    })
  }

  // ──────────────────────────────────────────────────
  // Step 4: Generate LinkedIn DM outreach drafts
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 65, "Generating outreach drafts")

  const brandVoice = await prisma.brandVoice.findFirst({ where: { isDefault: true } })
  const brandGuidelines = brandVoice?.guidelines || `
    You represent Bright Data, the world's leading web data platform.
    Be professional but approachable. Focus on the value of data and web intelligence.
    Show genuine interest in the prospect's work and how data can help them.
  `.trim()

  const minLeadScore = icpConfig?.minLeadScore ?? 0

  const engagementsNeedingDrafts = await prisma.engagement.findMany({
    where: {
      youtubeVideoId: video.id,
      source: "youtube",
      outreachDrafts: { none: { channel: "linkedin" } },
      engager: {
        ...(minLeadScore > 0 ? { leadScore: { gte: minLeadScore } } : {}),
      },
    },
    include: {
      engager: true,
      youtubeVideo: true,
    },
  })

  for (let i = 0; i < engagementsNeedingDrafts.length; i++) {
    const engagement = engagementsNeedingDrafts[i]
    await updateProgress(
      jobId,
      65 + Math.round((i / engagementsNeedingDrafts.length) * 30),
      `Generating draft ${i + 1}/${engagementsNeedingDrafts.length}`
    )

    const ctx: DraftContext = {
      engagerName: engagement.engager.name,
      engagerTitle: engagement.engager.currentTitle,
      engagerCompany: engagement.engager.currentCompany,
      engagerCountry: engagement.engager.country,
      engagerAbout: engagement.engager.aboutText,
      engagementType: "comment",
      commentText: engagement.commentText,
      postText: engagement.youtubeVideo?.title || "a YouTube video",
      postAuthorName: engagement.youtubeVideo?.channelName || "your channel",
      brandVoiceGuidelines: brandGuidelines,
    }

    try {
      const draft = await generateOutreachDraft(ctx)

      await prisma.outreachDraft.create({
        data: {
          engagerId: engagement.engagerId,
          engagementId: engagement.id,
          icebreaker: draft.icebreaker,
          fullDraft: draft.fullDraft,
          channel: "linkedin",
          personalizationContext: JSON.stringify({
            videoTitle: engagement.youtubeVideo?.title,
            videoUrl: engagement.youtubeVideo?.url,
            engagementType: "comment",
            commentText: engagement.commentText?.slice(0, 200),
            source: "youtube",
            leadScore: engagement.engager.leadScore,
          }),
        },
      })
      totalDraftsGenerated++
    } catch (error) {
      console.error(`Failed to generate draft for engager ${engagement.engager.name}:`, error)
    }
  }

  // ──────────────────────────────────────────────────
  // Finalize
  // ──────────────────────────────────────────────────
  await prisma.youTubeScrapeJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 100,
      currentStep: "Scrape complete",
      engagersFound: totalEngagersFound,
      draftsGenerated: totalDraftsGenerated,
      completedAt: new Date(),
    },
  })
}
