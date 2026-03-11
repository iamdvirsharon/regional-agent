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
import { useStats } from "@/components/providers/StatsProvider"

type UserRole = "admin" | "viewer" | null

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly: boolean
  group?: "setup" | "pipeline"
  completionKey?: string // key to check in stats for green dot
}

const allNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  // SETUP group
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true, group: "setup", completionKey: "hasKeys" },
  { href: "/companies", label: "Companies", icon: Building2, adminOnly: true, group: "setup", completionKey: "hasCompanies" },
  { href: "/youtube", label: "YouTube", icon: Video, adminOnly: true, group: "setup" },
  // PIPELINE group
  { href: "/engagers", label: "Engagers", icon: Users, adminOnly: false, group: "pipeline", completionKey: "hasEngagers" },
  { href: "/enrichment", label: "Enrichment", icon: Search, adminOnly: true, group: "pipeline" },
  { href: "/drafts", label: "Outreach Drafts", icon: MessageSquare, adminOnly: false, group: "pipeline", completionKey: "hasDrafts" },
  { href: "/export", label: "Export to Sheets", icon: Upload, adminOnly: true, group: "pipeline" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(null)
  const { stats } = useStats()

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.role))
      .catch(() => setRole(null))
  }, [])

  const navItems = allNavItems.filter(
    (item) => !item.adminOnly || role === "admin"
  )

  // Compute completion status from stats
  const completionStatus: Record<string, boolean> = {}
  if (stats) {
    completionStatus.hasKeys = stats.setupStatus.hasBrightDataKey && stats.setupStatus.hasAnthropicKey
    completionStatus.hasCompanies = stats.totalCompanies > 0 && stats.totalEmployees > 0
    completionStatus.hasEngagers = stats.totalEngagers > 0
    completionStatus.hasDrafts = stats.totalDrafts > 0
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  let lastGroup: string | undefined

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

      <nav className="flex-1 p-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))

          // Show group label when entering a new group
          let groupLabel = null
          if (item.group && item.group !== lastGroup) {
            lastGroup = item.group
            groupLabel = (
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-3 pt-4 pb-1.5">
                {item.group === "setup" ? "Setup" : "Pipeline"}
              </p>
            )
          } else if (!item.group && lastGroup) {
            lastGroup = undefined
          }

          const isComplete = item.completionKey ? completionStatus[item.completionKey] : undefined

          return (
            <div key={item.href}>
              {groupLabel}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {isComplete !== undefined && (
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isComplete ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                )}
              </Link>
            </div>
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
