import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const companies = await prisma.monitoredCompany.findMany({
    include: {
      employees: { select: { id: true, name: true, role: true, isActive: true, lastScrapedAt: true } },
      scrapeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, completedAt: true, engagersFound: true, postsFound: true, draftsGenerated: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, linkedinUrl } = body

  if (!name || !linkedinUrl) {
    return NextResponse.json(
      { error: "name and linkedinUrl are required" },
      { status: 400 }
    )
  }

  const company = await prisma.monitoredCompany.create({
    data: { name, linkedinUrl },
  })

  return NextResponse.json(company, { status: 201 })
}
