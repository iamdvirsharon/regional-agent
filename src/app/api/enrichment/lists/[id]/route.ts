import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const list = await prisma.enrichmentList.findUnique({
    where: { id },
    include: {
      engagers: {
        include: {
          engager: {
            select: {
              id: true, name: true, linkedinUrl: true, email: true,
              currentTitle: true, currentCompany: true, country: true,
              leadScore: true, enriched: true, source: true,
            },
          },
        },
      },
    },
  })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  return NextResponse.json(list)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.enrichmentList.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
