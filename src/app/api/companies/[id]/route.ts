import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const company = await prisma.monitoredCompany.findUnique({
    where: { id },
    include: {
      employees: true,
      scrapeJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(company)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const company = await prisma.monitoredCompany.update({
    where: { id },
    data: body,
  })

  return NextResponse.json(company)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.monitoredCompany.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
