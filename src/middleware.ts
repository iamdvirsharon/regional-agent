import { NextRequest, NextResponse } from "next/server"

// Routes that don't require any auth
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]

// Routes that require admin role
const adminPaths = ["/companies", "/settings", "/export"]

// API write operations require admin
function isApiWrite(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false
  if (pathname.startsWith("/api/auth/")) return false
  // Cron endpoint uses its own auth
  if (pathname === "/api/cron/scrape") return false
  return method !== "GET"
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method

  // Public paths - always allow
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Static assets
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) {
    return NextResponse.next()
  }

  // Check session cookie
  const session = req.cookies.get("lo_session")
  if (!session?.value) {
    // No session - redirect to login (for pages) or 401 (for API)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Decode role from cookie
  let role: string | null = null
  try {
    const decoded = Buffer.from(session.value, "base64").toString()
    role = decoded.split(":")[0]
  } catch {
    // Invalid cookie
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Admin-only pages
  if (adminPaths.some((p) => pathname.startsWith(p)) && role !== "admin") {
    // Viewer trying to access admin pages - redirect to dashboard
    return NextResponse.redirect(new URL("/", req.url))
  }

  // API write operations require admin
  if (isApiWrite(pathname, method) && role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
