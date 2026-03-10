import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// Fields that viewers (BDRs) can update
const VIEWER_ALLOWED_FIELDS = ["editedDraft", "editedEmailDraft", "outcome", "sentAt", "bdrNotes", "status"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const session = await getSession()

  // If viewer, filter to only allowed fields
  let data = body
  if (session?.role === "viewer") {
    data = Object.fromEntries(
      Object.entries(body).filter(([key]) => VIEWER_ALLOWED_FIELDS.includes(key))
    )
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const draft = await prisma.outreachDraft.update({
    where: { id },
    data,
  })

  return NextResponse.json(draft)
}
