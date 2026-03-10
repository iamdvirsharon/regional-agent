import { NextResponse } from "next/server"
import { exportToSheets } from "@/lib/sheets/export"
import { prisma } from "@/lib/prisma"

// GET: List export history
export async function GET() {
  const logs = await prisma.exportLog.findMany({
    orderBy: { exportedAt: "desc" },
    take: 20,
    include: {
      scrapeJob: {
        select: { company: { select: { name: true } } },
      },
    },
  })
  return NextResponse.json(logs)
}

// POST: Manual re-export
export async function POST() {
  try {
    const result = await exportToSheets()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Export failed:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
