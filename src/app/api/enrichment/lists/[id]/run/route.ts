import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const list = await prisma.enrichmentList.findUnique({ where: { id } })
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  if (list.status === "processing") {
    return NextResponse.json({ error: "Already processing" }, { status: 400 })
  }

  await prisma.enrichmentList.update({
    where: { id },
    data: { status: "processing" },
  })

  // Dispatch to worker
  const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/enrichment/worker`
  fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({ listId: id }),
  }).catch(() => {})

  return NextResponse.json({ started: true })
}
