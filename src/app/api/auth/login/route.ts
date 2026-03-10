import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validatePassword, createSessionValue } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { password } = body

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 })
  }

  const role = validatePassword(password)
  if (!role) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set("lo_session", createSessionValue(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  })

  return NextResponse.json({ role })
}
