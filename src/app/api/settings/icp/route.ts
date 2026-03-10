import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const configs = await prisma.iCPConfig.findMany({
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const config = await prisma.iCPConfig.create({
    data: {
      name: body.name || "Default",
      targetTitles: body.targetTitles ? JSON.stringify(body.targetTitles) : null,
      excludeTitles: body.excludeTitles ? JSON.stringify(body.excludeTitles) : null,
      excludeCompanies: body.excludeCompanies ? JSON.stringify(body.excludeCompanies) : null,
      targetCountries: body.targetCountries ? JSON.stringify(body.targetCountries) : null,
      minLeadScore: body.minLeadScore || 20,
      isActive: body.isActive !== false,
    },
  })

  // Deactivate other configs if this one is active
  if (config.isActive) {
    await prisma.iCPConfig.updateMany({
      where: { id: { not: config.id }, isActive: true },
      data: { isActive: false },
    })
  }

  return NextResponse.json(config, { status: 201 })
}
