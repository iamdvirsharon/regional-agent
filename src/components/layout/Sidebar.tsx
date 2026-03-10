"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  Upload,
  Settings,
  Zap,
  LogOut,
  Shield,
  Video,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

type UserRole = "admin" | "viewer" | null

const allNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/companies", label: "Companies", icon: Building2, adminOnly: true },
  { href: "/youtube", label: "YouTube", icon: Video, adminOnly: true },
  { href: "/engagers", label: "Engagers", icon: Users, adminOnly: false },
  { href: "/drafts", label: "Outreach Drafts", icon: MessageSquare, adminOnly: false },
  { href: "/enrichment", label: "Enrichment", icon: Search, adminOnly: true },
  { href: "/export", label: "Export to Sheets", icon: Upload, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.role))
      .catch(() => setRole(null))
  }, [])

  const navItems = allNavItems.filter(
    (item) => !item.adminOnly || role === "admin"
  )

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-64 border-r bg-white flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="font-bold text-lg leading-tight">LinkedIn Outreach</h1>
            <p className="text-xs text-muted-foreground">Bright Data</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t space-y-3">
        {role && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3 w-3" />
              {role === "admin" ? "Admin" : "Viewer"}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Powered by Bright Data + Claude AI
        </p>
      </div>
    </aside>
  )
}
