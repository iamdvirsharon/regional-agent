import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/export/csv?type=engagers|drafts
 * Returns a CSV file download of engagers or outreach drafts.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "engagers"

  if (type === "drafts") {
    return exportDrafts()
  }
  return exportEngagers()
}

async function exportEngagers(): Promise<NextResponse> {
  const engagers = await prisma.engager.findMany({
    include: {
      engagements: {
        include: {
          scrapedPost: {
            select: { linkedinPostUrl: true, postText: true },
          },
        },
        orderBy: { detectedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { leadScore: "desc" },
  })

  const headers = [
    "Name",
    "Title",
    "Company",
    "Country",
    "City",
    "Email",
    "LinkedIn URL",
    "Lead Score",
    "Engagement Type",
    "Comment",
    "Post URL",
    "Source",
    "Enriched",
    "Enrichment Provider",
    "Detected At",
  ]

  const rows = engagers.map((e) => {
    const eng = e.engagements[0]
    return [
      e.name,
      e.currentTitle || "",
      e.currentCompany || "",
      e.country || "",
      e.city || "",
      e.email || "",
      e.linkedinUrl || "",
      String(e.leadScore),
      eng?.type || "",
      csvEscape(eng?.commentText || ""),
      eng?.scrapedPost?.linkedinPostUrl || "",
      e.source,
      e.profileEnriched ? "Yes" : "No",
      e.enrichmentProvider || "",
      eng?.detectedAt ? new Date(eng.detectedAt).toISOString() : "",
    ]
  })

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="engagers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

async function exportDrafts(): Promise<NextResponse> {
  const drafts = await prisma.outreachDraft.findMany({
    include: {
      engager: {
        select: {
          name: true,
          currentTitle: true,
          currentCompany: true,
          country: true,
          email: true,
          linkedinUrl: true,
          leadScore: true,
        },
      },
      engagement: {
        select: {
          type: true,
          commentText: true,
          scrapedPost: { select: { linkedinPostUrl: true } },
        },
      },
    },
    orderBy: { generatedAt: "desc" },
  })

  const headers = [
    "Engager Name",
    "Title",
    "Company",
    "Country",
    "Email",
    "LinkedIn URL",
    "Lead Score",
    "Channel",
    "Subject",
    "Icebreaker",
    "Full Draft",
    "Status",
    "Outcome",
    "Engagement Type",
    "Comment",
    "Post URL",
    "Generated At",
  ]

  const rows = drafts.map((d) => [
    d.engager.name,
    d.engager.currentTitle || "",
    d.engager.currentCompany || "",
    d.engager.country || "",
    d.engager.email || "",
    d.engager.linkedinUrl || "",
    String(d.engager.leadScore),
    d.channel,
    d.emailSubject || "",
    d.icebreaker,
    d.editedDraft || d.fullDraft,
    d.status,
    d.outcome || "",
    d.engagement?.type || "",
    csvEscape(d.engagement?.commentText || ""),
    d.engagement?.scrapedPost?.linkedinPostUrl || "",
    new Date(d.generatedAt).toISOString(),
  ])

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outreach-drafts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

/** Escape a CSV field — wrap in quotes if it contains commas, quotes, or newlines */
function csvEscape(field: string): string {
  if (!field) return ""
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
