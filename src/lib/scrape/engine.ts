// Main scrape pipeline engine
// Sequential steps with progress tracking

import { prisma } from "@/lib/prisma"
import { discoverPosts, collectPostEngagement, collectPostLikers, enrichProfilesBatch } from "./brightdata"
import { generateOutreachDraft, type DraftContext } from "./claude"
import { calculateLeadScore } from "./scoring"

async function updateProgress(jobId: string, progress: number, step: string) {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: { progress, currentStep: step },
  })
}

// ================================================================
// Quick Scrape: paste a post URL → collect engagement → enrich → score → draft
// ================================================================
export async function runQuickScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } })
  if (!job || !job.postUrl) throw new Error(`Quick scrape job ${jobId} not found or missing postUrl`)

  let totalEngagersFound = 0
  let totalDraftsGenerated = 0

  // Find the ScrapedPost created by the quick route
  const post = await prisma.scrapedPost.findFirst({
    where: { linkedinPostUrl: job.postUrl },
  })
  if (!post) throw new Error(`ScrapedPost not found for URL ${job.postUrl}`)

  // ── Step 1: Collect comments ──
  await updateProgress(jobId, 10, "Collecting post comments")

  try {
    const comments = await collectPostEngagement(post.linkedinPostUrl)

    for (const comment of comments) {
      if (!comment.commenterUrl) continue

      let engager = await prisma.engager.findUnique({
        where: { linkedinUrl: comment.commenterUrl },
      })

      if (!engager) {
        engager = await prisma.engager.create({
          data: {
            linkedinUrl: comment.commenterUrl,
            name: comment.commenterName,
            headline: comment.commenterHeadline,
          },
        })
        totalEngagersFound++
      }

      try {
        await prisma.engagement.create({
          data: {
            engagerId: engager.id,
            scrapedPostId: post.id,
            type: "comment",
            commentText: comment.commentText,
          },
        })
      } catch {
        // Unique constraint — already exists
      }
    }
  } catch (error) {
    console.error(`Quick scrape: failed to collect comments for ${post.linkedinPostUrl}:`, error)
  }

  // ── Step 2: Collect likers ──
  await updateProgress(jobId, 25, "Collecting post likers")

  try {
    const likers = await collectPostLikers(post.linkedinPostUrl)

    for (const liker of likers) {
      if (!liker.likerUrl) continue

      let engager = await prisma.engager.findUnique({
        where: { linkedinUrl: liker.likerUrl },
      })

      if (!engager) {
        engager = await prisma.engager.create({
          data: {
            linkedinUrl: liker.likerUrl,
            name: liker.likerName,
            headline: liker.likerHeadline,
          },
        })
        totalEngagersFound++
      }

      try {
        await prisma.engagement.create({
          data: {
            engagerId: engager.id,
            scrapedPostId: post.id,
            type: "like",
          },
        })
      } catch {
        // Unique constraint — already exists
      }
    }
  } catch (error) {
    console.error(`Quick scrape: failed to collect likers for ${post.linkedinPostUrl}:`, error)
  }

  // Mark post as engagement-collected
  await prisma.scrapedPost.update({
    where: { id: post.id },
    data: { engagementsCollected: true },
  })

  // ── Step 3: Enrich new profiles ──
  await updateProgress(jobId, 40, "Enriching engager profiles")

  const unenriched = await prisma.engager.findMany({
    where: { profileEnriched: false },
  })

  if (unenriched.length > 0) {
    const batchSize = 100
    for (let batchStart = 0; batchStart < unenriched.length; batchStart += batchSize) {
      const batch = unenriched.slice(batchStart, batchStart + batchSize)
      const profileUrls = batch.filter((e) => e.linkedinUrl).map((e) => e.linkedinUrl!)

      await updateProgress(
        jobId,
        40 + Math.round((batchStart / unenriched.length) * 15),
        `Enriching profiles ${batchStart + 1}-${Math.min(batchStart + batchSize, unenriched.length)} of ${unenriched.length}`
      )

      try {
        const enrichedProfiles = await enrichProfilesBatch(profileUrls)

        for (const engager of batch) {
          const profile = engager.linkedinUrl ? enrichedProfiles.get(engager.linkedinUrl) : undefined
          if (profile) {
            await prisma.engager.update({
              where: { id: engager.id },
              data: {
                name: profile.name || engager.name,
                headline: profile.headline,
                country: profile.country,
                city: profile.city,
                currentCompany: profile.currentCompany,
                currentTitle: profile.currentTitle,
                aboutText: profile.aboutText,
                profileImageUrl: profile.profileImageUrl,
                profileEnriched: true,
                enrichedAt: new Date(),
              },
            })
          }
        }
      } catch (error) {
        console.error(`Quick scrape: profile enrichment batch failed (batch starting at ${batchStart}):`, error)
      }
    }
  }

  // ── Step 4: Score leads ──
  await updateProgress(jobId, 58, "Scoring leads")

  const icpConfig = await prisma.iCPConfig.findFirst({ where: { isActive: true } })
  const icpTargetTitles = icpConfig?.targetTitles ? JSON.parse(icpConfig.targetTitles) : []
  const icpExcludeTitles = icpConfig?.excludeTitles ? JSON.parse(icpConfig.excludeTitles) : []
  const icpExcludeCompanies = icpConfig?.excludeCompanies ? JSON.parse(icpConfig.excludeCompanies) : []
  const minLeadScore = icpConfig?.minLeadScore ?? 0

  const needsScoring = await prisma.engager.findMany({
    where: { profileEnriched: true, leadScore: 0 },
    include: { engagements: true },
  })

  for (const engager of needsScoring) {
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

  // ── Step 5: Generate outreach drafts ──
  await updateProgress(jobId, 68, "Generating outreach drafts")

  const brandVoice = await prisma.brandVoice.findFirst({ where: { isDefault: true } })
  const brandGuidelines = brandVoice?.guidelines || `
    You represent Bright Data, the world's leading web data platform.
    Be professional but approachable. Focus on the value of data and web intelligence.
    Show genuine interest in the prospect's work and how data can help them.
  `.trim()

  const engagementsNeedingDrafts = await prisma.engagement.findMany({
    where: {
      outreachDrafts: { none: { channel: "linkedin" } },
      source: "linkedin",
      engager: {
        profileEnriched: true,
        ...(minLeadScore > 0 ? { leadScore: { gte: minLeadScore } } : {}),
      },
    },
    include: {
      engager: true,
      scrapedPost: {
        include: { employeeProfile: true },
      },
    },
    orderBy: { engager: { leadScore: "desc" } },
  })

  for (let i = 0; i < engagementsNeedingDrafts.length; i++) {
    const engagement = engagementsNeedingDrafts[i]
    await updateProgress(
      jobId,
      68 + Math.round((i / engagementsNeedingDrafts.length) * 25),
      `Generating draft ${i + 1}/${engagementsNeedingDrafts.length}`
    )

    const ctx: DraftContext = {
      engagerName: engagement.engager.name,
      engagerTitle: engagement.engager.currentTitle,
      engagerCompany: engagement.engager.currentCompany,
      engagerCountry: engagement.engager.country,
      engagerAbout: engagement.engager.aboutText,
      engagementType: engagement.type as "like" | "comment",
      commentText: engagement.commentText,
      postText: engagement.scrapedPost?.postText || "",
      postAuthorName: engagement.scrapedPost?.employeeProfile?.name || "Unknown",
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
          personalizationContext: JSON.stringify({
            postText: ctx.postText.slice(0, 200),
            engagementType: ctx.engagementType,
            commentText: ctx.commentText?.slice(0, 200),
            postAuthor: ctx.postAuthorName,
            leadScore: engagement.engager.leadScore,
          }),
        },
      })
      totalDraftsGenerated++
    } catch (error) {
      console.error(`Quick scrape: failed to generate draft for ${engagement.engager.name}:`, error)
    }
  }

  // ── Finalize (skip auto-export) ──
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 100,
      currentStep: "Quick scrape complete",
      postsFound: 1,
      engagersFound: totalEngagersFound,
      draftsGenerated: totalDraftsGenerated,
      completedAt: new Date(),
    },
  })
}

export async function runScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.scrapeJob.findUnique({
    where: { id: jobId },
    include: {
      company: {
        include: { employees: { where: { isActive: true } } },
      },
    },
  })

  if (!job) throw new Error(`Job ${jobId} not found`)
  if (!job.company) throw new Error(`Job ${jobId} has no company — use runQuickScrapeJob for quick scrapes`)

  const { company } = job
  const employees = company.employees

  let totalPostsFound = 0
  let totalEngagersFound = 0
  let totalDraftsGenerated = 0

  // ──────────────────────────────────────────────────
  // Step 1: Discover recent posts for each employee
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 5, "Discovering employee posts")

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i]
    await updateProgress(
      jobId,
      5 + Math.round((i / employees.length) * 15),
      `Discovering posts for ${employee.name} (${i + 1}/${employees.length})`
    )

    try {
      const posts = await discoverPosts(employee.linkedinUrl, 20)

      for (const post of posts) {
        if (!post.url || !post.urn) continue

        const existing = await prisma.scrapedPost.findUnique({
          where: { postUrn: post.urn },
        })

        if (!existing) {
          await prisma.scrapedPost.create({
            data: {
              employeeProfileId: employee.id,
              linkedinPostUrl: post.url,
              postUrn: post.urn,
              postText: post.text,
              datePosted: post.datePosted ? new Date(post.datePosted) : null,
              numLikes: post.numLikes,
              numComments: post.numComments,
            },
          })
          totalPostsFound++
        }
      }

      await prisma.employeeProfile.update({
        where: { id: employee.id },
        data: { lastScrapedAt: new Date() },
      })
    } catch (error) {
      console.error(`Failed to discover posts for ${employee.name}:`, error)
    }
  }

  // ──────────────────────────────────────────────────
  // Step 2: Collect engagement on new posts (comments + likers)
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 22, "Collecting post engagement")

  const newPosts = await prisma.scrapedPost.findMany({
    where: {
      employeeProfileId: { in: employees.map((e) => e.id) },
      engagementsCollected: false,
    },
    include: { employeeProfile: true },
  })

  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i]
    await updateProgress(
      jobId,
      22 + Math.round((i / newPosts.length) * 20),
      `Collecting engagement for post ${i + 1}/${newPosts.length}`
    )

    try {
      // ── Collect comments ──
      const comments = await collectPostEngagement(post.linkedinPostUrl)

      for (const comment of comments) {
        if (!comment.commenterUrl) continue

        let engager = await prisma.engager.findUnique({
          where: { linkedinUrl: comment.commenterUrl },
        })

        if (!engager) {
          engager = await prisma.engager.create({
            data: {
              linkedinUrl: comment.commenterUrl,
              name: comment.commenterName,
              headline: comment.commenterHeadline,
            },
          })
          totalEngagersFound++
        }

        try {
          await prisma.engagement.create({
            data: {
              engagerId: engager.id,
              scrapedPostId: post.id,
              type: "comment",
              commentText: comment.commentText,
            },
          })
        } catch {
          // Unique constraint violation - already exists
        }
      }

      // ── Collect likers ──
      try {
        const likers = await collectPostLikers(post.linkedinPostUrl)

        for (const liker of likers) {
          if (!liker.likerUrl) continue

          let engager = await prisma.engager.findUnique({
            where: { linkedinUrl: liker.likerUrl },
          })

          if (!engager) {
            engager = await prisma.engager.create({
              data: {
                linkedinUrl: liker.likerUrl,
                name: liker.likerName,
                headline: liker.likerHeadline,
              },
            })
            totalEngagersFound++
          }

          try {
            await prisma.engagement.create({
              data: {
                engagerId: engager.id,
                scrapedPostId: post.id,
                type: "like",
              },
            })
          } catch {
            // Unique constraint violation - already exists
          }
        }
      } catch (error) {
        console.error(`Failed to collect likers for post ${post.linkedinPostUrl}:`, error)
        // Continue - comments were already collected
      }

      // Mark post as engagement-collected
      await prisma.scrapedPost.update({
        where: { id: post.id },
        data: { engagementsCollected: true },
      })
    } catch (error) {
      console.error(`Failed to collect engagement for post ${post.linkedinPostUrl}:`, error)
    }
  }

  // ──────────────────────────────────────────────────
  // Step 3: Enrich ALL new engager profiles (no cap — BD is free)
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 45, "Enriching engager profiles")

  const unenriched = await prisma.engager.findMany({
    where: { profileEnriched: false },
  })

  if (unenriched.length > 0) {
    // Process in batches of 100 for API reliability
    const batchSize = 100
    for (let batchStart = 0; batchStart < unenriched.length; batchStart += batchSize) {
      const batch = unenriched.slice(batchStart, batchStart + batchSize)
      const profileUrls = batch.filter((e) => e.linkedinUrl).map((e) => e.linkedinUrl!)

      await updateProgress(
        jobId,
        45 + Math.round((batchStart / unenriched.length) * 15),
        `Enriching profiles ${batchStart + 1}-${Math.min(batchStart + batchSize, unenriched.length)} of ${unenriched.length}`
      )

      try {
        const enrichedProfiles = await enrichProfilesBatch(profileUrls)

        for (const engager of batch) {
          const profile = engager.linkedinUrl ? enrichedProfiles.get(engager.linkedinUrl) : undefined
          if (profile) {
            await prisma.engager.update({
              where: { id: engager.id },
              data: {
                name: profile.name || engager.name,
                headline: profile.headline,
                country: profile.country,
                city: profile.city,
                currentCompany: profile.currentCompany,
                currentTitle: profile.currentTitle,
                aboutText: profile.aboutText,
                profileImageUrl: profile.profileImageUrl,
                profileEnriched: true,
                enrichedAt: new Date(),
              },
            })
          }
        }
      } catch (error) {
        console.error(`Profile enrichment batch failed (batch starting at ${batchStart}):`, error)
      }
    }
  }

  await updateProgress(jobId, 62, `Enriched ${unenriched.length} profiles`)

  // ──────────────────────────────────────────────────
  // Step 3b: Calculate lead scores for newly enriched engagers
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 64, "Scoring leads")

  // Load ICP config if available
  const icpConfig = await prisma.iCPConfig.findFirst({ where: { isActive: true } })
  const icpTargetTitles = icpConfig?.targetTitles ? JSON.parse(icpConfig.targetTitles) : []
  const icpExcludeTitles = icpConfig?.excludeTitles ? JSON.parse(icpConfig.excludeTitles) : []
  const icpExcludeCompanies = icpConfig?.excludeCompanies ? JSON.parse(icpConfig.excludeCompanies) : []
  const minLeadScore = icpConfig?.minLeadScore ?? 0

  // Score all engagers that were just enriched (leadScore still 0)
  const needsScoring = await prisma.engager.findMany({
    where: { profileEnriched: true, leadScore: 0 },
    include: { engagements: true },
  })

  for (const engager of needsScoring) {
    // Find the best engagement for scoring (prefer comments)
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

  // ──────────────────────────────────────────────────
  // Step 4: Generate outreach drafts for new engagements
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 68, "Generating outreach drafts")

  const brandVoice = await prisma.brandVoice.findFirst({
    where: { isDefault: true },
  })

  const brandGuidelines = brandVoice?.guidelines || `
    You represent Bright Data, the world's leading web data platform.
    Be professional but approachable. Focus on the value of data and web intelligence.
    Show genuine interest in the prospect's work and how data can help them.
  `.trim()

  // Find engagements without drafts, skip low-score engagers if ICP threshold is set
  const engagementsNeedingDrafts = await prisma.engagement.findMany({
    where: {
      outreachDrafts: { none: { channel: "linkedin" } },
      source: "linkedin",
      engager: {
        profileEnriched: true,
        ...(minLeadScore > 0 ? { leadScore: { gte: minLeadScore } } : {}),
      },
    },
    include: {
      engager: true,
      scrapedPost: {
        include: { employeeProfile: true },
      },
    },
    orderBy: { engager: { leadScore: "desc" } },
  })

  for (let i = 0; i < engagementsNeedingDrafts.length; i++) {
    const engagement = engagementsNeedingDrafts[i]
    await updateProgress(
      jobId,
      68 + Math.round((i / engagementsNeedingDrafts.length) * 22),
      `Generating draft ${i + 1}/${engagementsNeedingDrafts.length}`
    )

    const ctx: DraftContext = {
      engagerName: engagement.engager.name,
      engagerTitle: engagement.engager.currentTitle,
      engagerCompany: engagement.engager.currentCompany,
      engagerCountry: engagement.engager.country,
      engagerAbout: engagement.engager.aboutText,
      engagementType: engagement.type as "like" | "comment",
      commentText: engagement.commentText,
      postText: engagement.scrapedPost?.postText || "",
      postAuthorName: engagement.scrapedPost?.employeeProfile?.name || "Unknown",
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
          personalizationContext: JSON.stringify({
            postText: ctx.postText.slice(0, 200),
            engagementType: ctx.engagementType,
            commentText: ctx.commentText?.slice(0, 200),
            postAuthor: ctx.postAuthorName,
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
  // Step 5: Auto-export to Google Sheets
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 92, "Exporting to Google Sheets")

  try {
    const { exportToSheets } = await import("@/lib/sheets/export")
    await exportToSheets(jobId)
  } catch (error) {
    console.error("Auto-export failed (non-fatal):", error)
    // Don't fail the job for export errors
  }

  // ──────────────────────────────────────────────────
  // Step 6: Finalize
  // ──────────────────────────────────────────────────
  await updateProgress(jobId, 95, "Finalizing")

  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 100,
      currentStep: "Scrape complete",
      postsFound: totalPostsFound,
      engagersFound: totalEngagersFound,
      draftsGenerated: totalDraftsGenerated,
      completedAt: new Date(),
    },
  })
}
