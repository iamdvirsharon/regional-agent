// Google Sheets export for BDR team delivery
// Writes engagement data segmented by country into tabs

import { google } from "googleapis"
import { prisma } from "@/lib/prisma"

interface SheetRow {
  name: string
  title: string
  company: string
  linkedinUrl: string
  email: string
  engagedPost: string
  engagementType: string
  commentText: string
  icebreaker: string
  fullDraft: string
  emailSubject: string
  emailDraft: string
  leadScore: number
  country: string
  channel: string
  date: string
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  if (!email || !key) {
    throw new Error("Google service account credentials not configured")
  }

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

/**
 * Export new outreach drafts to Google Sheets, segmented by country.
 * Creates a tab per country if it doesn't exist.
 */
export async function exportToSheets(
  scrapeJobId?: string
): Promise<{ sheetUrl: string; countriesExported: string[]; totalRows: number }> {
  const sheetId = process.env.GOOGLE_SHEET_ID
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID not configured")

  const auth = getAuth()
  const sheets = google.sheets({ version: "v4", auth })

  // Fetch drafts that haven't been exported yet
  const drafts = await prisma.outreachDraft.findMany({
    where: { status: "draft" },
    include: {
      engager: true,
      engagement: {
        include: {
          scrapedPost: {
            include: { employeeProfile: true },
          },
          youtubeVideo: true,
        },
      },
    },
    orderBy: { generatedAt: "desc" },
  })

  if (drafts.length === 0) {
    return { sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`, countriesExported: [], totalRows: 0 }
  }

  // Group by country
  const byCountry = new Map<string, SheetRow[]>()

  for (const draft of drafts) {
    const country = draft.engager.country || "Unknown"
    if (!byCountry.has(country)) {
      byCountry.set(country, [])
    }

    byCountry.get(country)!.push({
      name: draft.engager.name,
      title: draft.engager.currentTitle || "",
      company: draft.engager.currentCompany || "",
      linkedinUrl: draft.engager.linkedinUrl || "",
      email: draft.engager.email || "",
      engagedPost: draft.engagement.scrapedPost?.linkedinPostUrl || draft.engagement.youtubeVideo?.url || "",
      engagementType: draft.engagement.type,
      commentText: draft.engagement.commentText || "",
      icebreaker: draft.icebreaker,
      fullDraft: draft.fullDraft,
      emailSubject: draft.emailSubject || "",
      emailDraft: draft.emailDraft || "",
      leadScore: draft.engager.leadScore,
      country,
      channel: draft.channel,
      date: new Date().toISOString().split("T")[0],
    })
  }

  // Get existing sheet tabs
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const existingTabs = new Set(
    spreadsheet.data.sheets?.map((s) => s.properties?.title) || []
  )

  const countriesExported: string[] = []
  let totalRows = 0

  const HEADER_ROW = [
    "Name", "Title", "Company", "LinkedIn URL", "Email", "Engaged Post",
    "Engagement Type", "Comment", "Icebreaker", "Full Draft",
    "Email Subject", "Email Draft", "Lead Score", "Country", "Channel", "Date"
  ]

  for (const [country, rows] of byCountry) {
    const tabName = country.length > 30 ? country.slice(0, 30) : country

    // Create tab if it doesn't exist
    if (!existingTabs.has(tabName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName },
              },
            },
          ],
        },
      })

      // Write header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${tabName}'!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADER_ROW],
        },
      })

      existingTabs.add(tabName)
    }

    // Append data rows
    const dataRows = rows.map((row) => [
      row.name,
      row.title,
      row.company,
      row.linkedinUrl,
      row.email,
      row.engagedPost,
      row.engagementType,
      row.commentText,
      row.icebreaker,
      row.fullDraft,
      row.emailSubject,
      row.emailDraft,
      String(row.leadScore),
      row.country,
      row.channel,
      row.date,
    ])

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tabName}'!A:P`,
      valueInputOption: "RAW",
      requestBody: {
        values: dataRows,
      },
    })

    countriesExported.push(country)
    totalRows += rows.length
  }

  // Update Summary tab
  await updateSummaryTab(sheets, sheetId, existingTabs, byCountry)

  // Mark drafts as exported
  const draftIds = drafts.map((d) => d.id)
  await prisma.outreachDraft.updateMany({
    where: { id: { in: draftIds } },
    data: { status: "exported" },
  })

  // Log the export
  if (scrapeJobId) {
    await prisma.exportLog.create({
      data: {
        scrapeJobId,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
        countriesExported: JSON.stringify(countriesExported),
        totalRows,
      },
    })
  }

  return {
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
    countriesExported,
    totalRows,
  }
}

async function updateSummaryTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  existingTabs: Set<string | null | undefined>,
  byCountry: Map<string, SheetRow[]>
) {
  const summaryTab = "Summary"

  if (!existingTabs.has(summaryTab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: summaryTab, index: 0 },
            },
          },
        ],
      },
    })
  }

  const today = new Date().toISOString().split("T")[0]
  const summaryRows = [
    ["Country", "New Leads", "Date"],
    ...Array.from(byCountry.entries()).map(([country, rows]) => [
      country,
      String(rows.length),
      today,
    ]),
    ["", "", ""],
    ["Total", String(Array.from(byCountry.values()).reduce((sum, rows) => sum + rows.length, 0)), today],
  ]

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${summaryTab}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: summaryRows,
    },
  })
}
