// Multi-provider enrichment pipeline
// Takes an enrichment list, uses the configured provider, updates profiles + scores

import { prisma } from "@/lib/prisma"
import { getEnrichmentClient, type EnrichmentProvider } from "./index"
import { calculateLeadScore } from "@/lib/scrape/scoring"
import { generateEmailDraft, type DraftContext } from "@/lib/scrape/claude"
import { hasConfigValue } from "@/lib/config"

export async function runEnrichment(listId: string): Promise<void> {
  const list = await prisma.enrichmentList.findUnique({
    where: { id: listId },
    include: {
      engagers: {
        where: { status: "pending" },
        include: { engager: true },
      },
    },
  })

  if (!list) throw new Error(`Enrichment list ${listId} not found`)

  // Pre-flight: check that the provider's API key is actually configured
  const provider = list.provider as EnrichmentProvider
  const keyCheckMap: Record<string, () => Promise<boolean>> = {
    apollo: () => hasConfigValue("APOLLO_API_KEY"),
    zoominfo: async () => (await hasConfigValue("ZOOMINFO_CLIENT_ID")) && (await hasConfigValue("ZOOMINFO_PRIVATE_KEY")),
    leadiq: () => hasConfigValue("LEADIQ_API_KEY"),
  }

  const checker = keyCheckMap[provider]
  if (checker && !(await checker())) {
    await prisma.enrichmentList.update({
      where: { id: listId },
      data: {
        status: "failed",
        errorMessage: `API key for ${provider} is not configured. Add the key in Settings → API Keys and try again.`,
      },
    })
    return
  }

  const client = await getEnrichmentClient(provider)
  let enrichedCount = 0
  const failedEngagerIds = new Set<string>()

  for (let i = 0; i < list.engagers.length; i++) {
    const entry = list.engagers[i]
    const engager = entry.engager

    // Build input from engager data
    const nameParts = engager.name.split(" ")
    const input = {
      firstName: nameParts[0] || engager.name,
      lastName: nameParts.slice(1).join(" ") || "",
      company: engager.currentCompany || undefined,
      linkedinUrl: engager.linkedinUrl || undefined,
    }

    try {
      const result = await client.enrich(input)

      if (result) {
        await prisma.engager.update({
          where: { id: engager.id },
          data: {
            email: result.email || engager.email,
            linkedinUrl: result.linkedinUrl || engager.linkedinUrl,
            currentTitle: result.title || engager.currentTitle,
            currentCompany: result.company || engager.currentCompany,
            country: result.country || engager.country,
            city: result.city || engager.city,
            headline: result.headline || engager.headline,
            enriched: true,
            dataEnrichedAt: new Date(),
            enrichmentProvider: list.provider,
          },
        })

        await prisma.enrichmentListEngager.update({
          where: { id: entry.id },
          data: { status: "enriched" },
        })

        enrichedCount++
      } else {
        await prisma.enrichmentListEngager.update({
          where: { id: entry.id },
          data: { status: "not_found" },
        })
      }
    } catch (error) {
      console.error(`Enrichment failed for ${engager.name}:`, error)
      failedEngagerIds.add(engager.id)
      await prisma.enrichmentListEngager.update({
        where: { id: entry.id },
        data: { status: "failed", errorDetail: String(error) },
      })
    }

    // Update list progress
    await prisma.enrichmentList.update({
      where: { id: listId },
      data: { enrichedCount },
    })

    // Rate limit
    if (i < list.engagers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // Re-score enriched engagers
  const icpConfig = await prisma.iCPConfig.findFirst({ where: { isActive: true } })
  const icpTargetTitles = icpConfig?.targetTitles ? JSON.parse(icpConfig.targetTitles) : []
  const icpExcludeTitles = icpConfig?.excludeTitles ? JSON.parse(icpConfig.excludeTitles) : []
  const icpExcludeCompanies = icpConfig?.excludeCompanies ? JSON.parse(icpConfig.excludeCompanies) : []

  const enrichedEngagerIds = list.engagers
    .filter((e) => !failedEngagerIds.has(e.engagerId))
    .map((e) => e.engagerId)

  const engagersToRescore = await prisma.engager.findMany({
    where: { id: { in: enrichedEngagerIds }, enriched: true },
    include: { engagements: true },
  })

  for (const engager of engagersToRescore) {
    const bestEngagement = engager.engagements.find((e) => e.type === "comment") || engager.engagements[0]

    const result = calculateLeadScore({
      currentTitle: engager.currentTitle,
      currentCompany: engager.currentCompany,
      aboutText: engager.aboutText,
      engagementType: (bestEngagement?.type as "like" | "comment") || "like",
      commentText: bestEngagement?.commentText || null,
      engagementCount: engager.engagements.length,
      icpTargetTitles,
      icpExcludeTitles,
      icpExcludeCompanies,
    })

    await prisma.engager.update({
      where: { id: engager.id },
      data: {
        leadScore: result.score,
        scoreFactors: JSON.stringify(result.factors),
      },
    })
  }

  // Generate email drafts for engagers with newly found emails
  const brandVoice = await prisma.brandVoice.findFirst({ where: { isDefault: true } })
  const brandGuidelines = brandVoice?.guidelines || `
    You represent Bright Data, the world's leading web data platform.
    Be professional but approachable. Focus on the value of data and web intelligence.
  `.trim()

  const engagersWithEmail = await prisma.engager.findMany({
    where: {
      id: { in: enrichedEngagerIds },
      email: { not: null },
      enriched: true,
    },
    include: {
      engagements: {
        include: {
          scrapedPost: { include: { employeeProfile: true } },
          youtubeVideo: true,
        },
        take: 1,
        orderBy: { detectedAt: "desc" },
      },
    },
  })

  for (const engager of engagersWithEmail) {
    const engagement = engager.engagements[0]
    if (!engagement) continue

    // Check if email draft already exists
    const existingDraft = await prisma.outreachDraft.findFirst({
      where: { engagementId: engagement.id, channel: "email" },
    })
    if (existingDraft) continue

    const ctx: DraftContext = {
      engagerName: engager.name,
      engagerTitle: engager.currentTitle,
      engagerCompany: engager.currentCompany,
      engagerCountry: engager.country,
      engagerAbout: engager.aboutText,
      engagementType: (engagement.type as "like" | "comment") || "comment",
      commentText: engagement.commentText,
      postText: engagement.scrapedPost?.postText || engagement.youtubeVideo?.title || "",
      postAuthorName: engagement.scrapedPost?.employeeProfile?.name || engagement.youtubeVideo?.channelName || "our team",
      brandVoiceGuidelines: brandGuidelines,
    }

    try {
      const emailDraft = await generateEmailDraft(ctx)

      await prisma.outreachDraft.create({
        data: {
          engagerId: engager.id,
          engagementId: engagement.id,
          icebreaker: emailDraft.subject,
          fullDraft: emailDraft.body,
          channel: "email",
          emailSubject: emailDraft.subject,
          emailDraft: emailDraft.body,
        },
      })
    } catch (error) {
      console.error(`Failed to generate email draft for ${engager.name}:`, error)
    }
  }

  // Mark list completed
  await prisma.enrichmentList.update({
    where: { id: listId },
    data: {
      status: "completed",
      enrichedCount,
      completedAt: new Date(),
    },
  })
}
