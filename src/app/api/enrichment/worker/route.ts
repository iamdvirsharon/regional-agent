import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runEnrichment } from "@/lib/enrichment/pipeline"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get("x-internal-key")
  if (
    process.env.INTERNAL_API_KEY &&
    internalKey !== process.env.INTERNAL_API_KEY
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const listId = body.listId

  // Find list to process
  const list = listId
    ? await prisma.enrichmentList.findUnique({ where: { id: listId } })
    : await prisma.enrichmentList.findFirst({
        where: { status: "processing" },
        orderBy: { createdAt: "asc" },
      })

  if (!list) {
    return NextResponse.json({ message: "No enrichment lists to process" })
  }

  try {
    await runEnrichment(list.id)
  } catch (error) {
    console.error(`Enrichment list ${list.id} failed:`, error)
    await prisma.enrichmentList.update({
      where: { id: list.id },
      data: {
        status: "failed",
        errorMessage: String(error),
        completedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ processed: list.id })
}
