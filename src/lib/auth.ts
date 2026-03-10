// Simple cookie-based auth
// Admin: can configure companies, employees, brand voice, trigger scrapes, export
// Viewer: can view dashboard, engagers, drafts (read-only)

import { cookies } from "next/headers"

export type UserRole = "admin" | "viewer"

const COOKIE_NAME = "lo_session"
// Session is just the role encoded - simple and stateless
// Admin logs in with ADMIN_PASSWORD env var
// Viewers log in with VIEWER_PASSWORD env var (optional - if not set, viewer access is open)

export async function getSession(): Promise<{ role: UserRole } | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  if (!session?.value) return null

  try {
    const decoded = Buffer.from(session.value, "base64").toString()
    const [role, token] = decoded.split(":")

    // Validate the token matches expected secret
    const expectedToken = generateToken(role as UserRole)
    if (token !== expectedToken) return null

    return { role: role as UserRole }
  } catch {
    return null
  }
}

export function generateToken(role: UserRole): string {
  const secret = process.env.INTERNAL_API_KEY || "default-secret"
  // Simple HMAC-like token (not cryptographically strong, but sufficient for internal tool)
  let hash = 0
  const str = `${role}:${secret}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

export function createSessionValue(role: UserRole): string {
  const token = generateToken(role)
  return Buffer.from(`${role}:${token}`).toString("base64")
}

export function validatePassword(password: string): UserRole | null {
  const adminPw = process.env.ADMIN_PASSWORD
  const viewerPw = process.env.VIEWER_PASSWORD

  if (adminPw && password === adminPw) return "admin"
  if (viewerPw && password === viewerPw) return "viewer"

  return null
}

export function isAdminRoute(pathname: string): boolean {
  const adminPaths = ["/companies", "/settings", "/export"]
  return adminPaths.some((p) => pathname.startsWith(p))
}

export function isApiWriteRoute(pathname: string, method: string): boolean {
  if (method === "GET") return false
  // All POST/PATCH/DELETE on API routes require admin
  return pathname.startsWith("/api/")
}
