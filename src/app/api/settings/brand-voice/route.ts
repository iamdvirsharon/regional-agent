import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const voices = await prisma.brandVoice.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(voices)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, companyName, guidelines, tone, doRules, dontRules, isDefault } = body

  if (!name || !companyName || !guidelines) {
    return NextResponse.json(
      { error: "name, companyName, and guidelines are required" },
      { status: 400 }
    )
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.brandVoice.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  const voice = await prisma.brandVoice.create({
    data: {
      name,
      companyName,
      guidelines,
      tone: tone || null,
      doRules: doRules || null,
      dontRules: dontRules || null,
      isDefault: isDefault || false,
    },
  })

  return NextResponse.json(voice, { status: 201 })
}
