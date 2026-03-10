import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId } = body

  if (companyId) {
    // Trigger scrape for a specific company
    const company = await prisma.monitoredCompany.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const job = await prisma.scrapeJob.create({
      data: { companyId: company.id },
    })

    // Kick off the worker
    const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/scrape/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})

    return NextResponse.json({ jobId: job.id, status: "queued" })
  }

  // Trigger scrape for ALL active companies
  const companies = await prisma.monitoredCompany.findMany({
    where: { isActive: true },
  })

  const jobs = []
  for (const company of companies) {
    const job = await prisma.scrapeJob.create({
      data: { companyId: company.id },
    })
    jobs.push({ jobId: job.id, companyName: company.name })
  }

  // Kick off the worker
  if (jobs.length > 0) {
    const workerUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/scrape/worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY || "" },
    }).catch(() => {})
  }

  return NextResponse.json({ jobs, total: jobs.length })
}
