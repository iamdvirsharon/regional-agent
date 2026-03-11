import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hasConfigValue } from "@/lib/config"

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 7 days ago for trend data
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    totalCompanies,
    totalEmployees,
    totalEngagers,
    engagersToday,
    totalDrafts,
    draftsToday,
    countryCounts,
    recentJobs,
    // Funnel data
    draftsByStatus,
    outcomeBreakdown,
    totalSent,
    totalExported,
    // Trend: engagers per day (last 7 days)
    recentEngagers,
    recentDrafts,
    // YouTube stats
    totalYouTubeVideos,
    youtubeEngagers,
    // Enriched stats
    enrichedCount,
    engagersWithEmail,
  ] = await Promise.all([
    prisma.monitoredCompany.count({ where: { isActive: true } }),
    prisma.employeeProfile.count({ where: { isActive: true } }),
    prisma.engager.count(),
    prisma.engager.count({ where: { createdAt: { gte: today } } }),
    prisma.outreachDraft.count(),
    prisma.outreachDraft.count({ where: { generatedAt: { gte: today } } }),
    prisma.engager.groupBy({
      by: ["country"],
      _count: { country: true },
      where: { country: { not: null } },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.scrapeJob.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        NOT: { status: "failed", errorMessage: { startsWith: "Cancelled:" } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { company: { select: { name: true } } },
    }),
    // Funnel
    prisma.outreachDraft.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.outreachDraft.groupBy({
      by: ["outcome"],
      _count: { outcome: true },
      where: { outcome: { not: null } },
    }),
    prisma.outreachDraft.count({ where: { status: "sent" } }),
    prisma.outreachDraft.count({ where: { status: "exported" } }),
    // Trend: recent engagers
    prisma.engager.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.outreachDraft.findMany({
      where: { generatedAt: { gte: sevenDaysAgo } },
      select: { generatedAt: true, sentAt: true },
    }),
    // YouTube
    prisma.youTubeVideo.count(),
    prisma.engager.count({ where: { source: "youtube" } }),
    // Enriched
    prisma.engager.count({ where: { enriched: true } }),
    prisma.engager.count({ where: { email: { not: null } } }),
  ])

  // Build daily trend for last 7 days
  const weeklyTrend = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayEngagers = recentEngagers.filter(
      (e) => new Date(e.createdAt) >= date && new Date(e.createdAt) < nextDate
    ).length

    const dayDrafts = recentDrafts.filter(
      (d) => new Date(d.generatedAt) >= date && new Date(d.generatedAt) < nextDate
    ).length

    const daySent = recentDrafts.filter(
      (d) => d.sentAt && new Date(d.sentAt) >= date && new Date(d.sentAt) < nextDate
    ).length

    weeklyTrend.push({
      date: date.toISOString().split("T")[0],
      engagers: dayEngagers,
      drafts: dayDrafts,
      sent: daySent,
    })
  }

  // Build funnel
  const statusMap = Object.fromEntries(draftsByStatus.map((d) => [d.status, d._count.status]))
  const outcomeMap = Object.fromEntries(outcomeBreakdown.map((d) => [d.outcome, d._count.outcome]))

  const funnel = {
    totalEngagers,
    totalDrafts,
    exported: totalExported + totalSent,
    sent: totalSent,
    replied: outcomeMap["replied"] || 0,
    connected: outcomeMap["connected"] || 0,
  }

  // Setup status for pipeline tracker
  const [hasBrightDataKey, hasAnthropicKey, hasApolloKey, hasZoomInfoKey, hasLeadIQKey, hasExportEmail, hasExportSheet, brandVoiceCount] = await Promise.all([
    hasConfigValue("BRIGHT_DATA_API_KEY"),
    hasConfigValue("ANTHROPIC_API_KEY"),
    hasConfigValue("APOLLO_API_KEY"),
    hasConfigValue("ZOOMINFO_CLIENT_ID"),
    hasConfigValue("LEADIQ_API_KEY"),
    hasConfigValue("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    hasConfigValue("GOOGLE_SHEET_ID"),
    prisma.brandVoice.count(),
  ])

  const lastCompletedJob = recentJobs.find((j) => j.status === "completed")

  return NextResponse.json({
    totalCompanies,
    totalEmployees,
    totalEngagers,
    engagersToday,
    totalDrafts,
    draftsToday,
    topCountries: countryCounts.map((c) => ({
      country: c.country,
      count: c._count.country,
    })),
    recentJobs,
    funnel,
    weeklyTrend,
    // YouTube & Enrichment
    totalYouTubeVideos,
    youtubeEngagers,
    enrichedCount,
    engagersWithEmail,
    emailCoverage: totalEngagers > 0 ? Math.round((engagersWithEmail / totalEngagers) * 100) : 0,
    // Pipeline setup status
    setupStatus: {
      hasBrightDataKey,
      hasAnthropicKey,
      hasBrandVoice: brandVoiceCount > 0,
      hasEnrichmentKey: hasApolloKey || hasZoomInfoKey || hasLeadIQKey,
      hasExportKeys: hasExportEmail && hasExportSheet,
    },
    lastScrapeAt: lastCompletedJob?.completedAt || null,
  })
}
