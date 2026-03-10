import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const employees = await prisma.employeeProfile.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(employees)
}

// POST: Add single employee OR bulk import (array)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  // Bulk import: body is an array
  if (Array.isArray(body)) {
    const valid = body.filter((e: { name?: string; linkedinUrl?: string }) => e.name && e.linkedinUrl)
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid employees in array" }, { status: 400 })
    }

    let created = 0
    for (const e of valid as { name: string; linkedinUrl: string; role?: string }[]) {
      const exists = await prisma.employeeProfile.findFirst({
        where: { companyId: id, linkedinUrl: e.linkedinUrl },
      })
      if (!exists) {
        await prisma.employeeProfile.create({
          data: { companyId: id, name: e.name, linkedinUrl: e.linkedinUrl, role: e.role || null },
        })
        created++
      }
    }

    return NextResponse.json({ created }, { status: 201 })
  }

  // Single employee
  const { name, linkedinUrl, role } = body

  if (!name || !linkedinUrl) {
    return NextResponse.json(
      { error: "name and linkedinUrl are required" },
      { status: 400 }
    )
  }

  const employee = await prisma.employeeProfile.create({
    data: {
      companyId: id,
      name,
      linkedinUrl,
      role: role || null,
    },
  })

  return NextResponse.json(employee, { status: 201 })
}

// PUT: Auto-discover employees from company LinkedIn page
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const company = await prisma.monitoredCompany.findUnique({ where: { id } })
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  try {
    const { discoverCompanyEmployees } = await import("@/lib/scrape/brightdata")
    const discovered = await discoverCompanyEmployees(company.linkedinUrl)

    if (discovered.length === 0) {
      return NextResponse.json({ message: "No employees found", created: 0 })
    }

    let created = 0
    for (const e of discovered) {
      const exists = await prisma.employeeProfile.findFirst({
        where: { companyId: id, linkedinUrl: e.profileUrl },
      })
      if (!exists) {
        await prisma.employeeProfile.create({
          data: { companyId: id, name: e.name, linkedinUrl: e.profileUrl, role: e.title || null },
        })
        created++
      }
    }

    return NextResponse.json({
      message: `Discovered ${discovered.length} employees, added ${created} new`,
      discovered: discovered.length,
      created,
    })
  } catch (error) {
    console.error("Employee discovery failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 500 }
    )
  }
}
