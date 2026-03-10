"use client"

import { useEffect, useState } from "react"
import {
  Users,
  MessageSquare,
  Globe,
  Building2,
  RefreshCw,
  Play,
  TrendingUp,
  Video,
  Search,
  Mail,
} from "lucide-react"

interface Stats {
  totalCompanies: number
  totalEmployees: number
  totalEngagers: number
  engagersToday: number
  totalDrafts: number
  draftsToday: number
  topCountries: { country: string; count: number }[]
  recentJobs: {
    id: string
    status: string
    progress: number
    currentStep: string | null
    engagersFound: number
    postsFound: number
    draftsGenerated: number
    completedAt: string | null
    createdAt: string
    company: { name: string }
  }[]
  funnel: {
    totalEngagers: number
    totalDrafts: number
    exported: number
    sent: number
    replied: number
    connected: number
  }
  weeklyTrend: {
    date: string
    engagers: number
    drafts: number
    sent: number
  }[]
  // YouTube & Enrichment
  totalYouTubeVideos: number
  youtubeEngagers: number
  enrichedCount: number
  engagersWithEmail: number
  emailCoverage: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  async function fetchStats() {
    try {
      const res = await fetch("/api/stats")
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  async function triggerScrape() {
    setTriggering(true)
    try {
      await fetch("/api/scrape/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      await fetchStats()
    } catch (error) {
      console.error("Failed to trigger scrape:", error)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            LinkedIn engagement monitoring and outreach pipeline
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={triggerScrape}
            disabled={triggering}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {triggering ? "Triggering..." : "Run Scrape Now"}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          label="Monitored Companies"
          value={stats?.totalCompanies || 0}
          sub={`${stats?.totalEmployees || 0} employees tracked`}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-green-600" />}
          label="Total Engagers"
          value={stats?.totalEngagers || 0}
          sub={`+${stats?.engagersToday || 0} today`}
          highlight={!!stats?.engagersToday}
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
          label="Outreach Drafts"
          value={stats?.totalDrafts || 0}
          sub={`+${stats?.draftsToday || 0} today`}
          highlight={!!stats?.draftsToday}
        />
        <StatCard
          icon={<Globe className="h-5 w-5 text-orange-600" />}
          label="Countries Covered"
          value={stats?.topCountries?.length || 0}
          sub="unique countries"
        />
      </div>

      {/* YouTube & Enrichment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Video className="h-5 w-5 text-red-600" />}
          label="YouTube Videos"
          value={stats?.totalYouTubeVideos || 0}
          sub={`${stats?.youtubeEngagers || 0} YouTube engagers`}
        />
        <StatCard
          icon={<Search className="h-5 w-5 text-indigo-600" />}
          label="Enriched"
          value={stats?.enrichedCount || 0}
          sub="engagers enriched"
        />
        <StatCard
          icon={<Mail className="h-5 w-5 text-amber-600" />}
          label="Email Coverage"
          value={stats?.engagersWithEmail || 0}
          sub={`${stats?.emailCoverage || 0}% of all engagers`}
        />
      </div>

      {/* Conversion Funnel */}
      {stats?.funnel && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Conversion Funnel
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { label: "Engagers", value: stats.funnel.totalEngagers, color: "bg-blue-500" },
              { label: "Drafts", value: stats.funnel.totalDrafts, color: "bg-purple-500" },
              { label: "Exported", value: stats.funnel.exported, color: "bg-indigo-500" },
              { label: "Sent", value: stats.funnel.sent, color: "bg-green-500" },
              { label: "Replied", value: stats.funnel.replied, color: "bg-emerald-500" },
              { label: "Connected", value: stats.funnel.connected, color: "bg-teal-500" },
            ].map((step, i, arr) => {
              const prevValue = i > 0 ? arr[i - 1].value : step.value
              const rate = prevValue > 0 ? Math.round((step.value / prevValue) * 100) : 0
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="flex flex-col items-center min-w-[90px]">
                    <div className={`${step.color} text-white rounded-lg px-3 py-2 text-center w-full`}>
                      <p className="text-lg font-bold">{step.value.toLocaleString()}</p>
                      <p className="text-xs opacity-90">{step.label}</p>
                    </div>
                    {i > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{rate}%</p>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-gray-300 text-lg">&rarr;</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Trend */}
        {stats?.weeklyTrend && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">7-Day Activity</h2>
            <div className="space-y-3">
              {stats.weeklyTrend.map((day) => {
                const maxVal = Math.max(...stats.weeklyTrend.map((d) => d.engagers + d.drafts + d.sent), 1)
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {new Date(day.date + "T12:00:00").toLocaleDateString("en", { weekday: "short" })}
                    </span>
                    <div className="flex-1 flex gap-0.5 h-5">
                      <div
                        className="bg-blue-400 rounded-l"
                        style={{ width: `${(day.engagers / maxVal) * 100}%` }}
                        title={`${day.engagers} engagers`}
                      />
                      <div
                        className="bg-purple-400"
                        style={{ width: `${(day.drafts / maxVal) * 100}%` }}
                        title={`${day.drafts} drafts`}
                      />
                      <div
                        className="bg-green-400 rounded-r"
                        style={{ width: `${(day.sent / maxVal) * 100}%` }}
                        title={`${day.sent} sent`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">
                      {day.engagers}e / {day.drafts}d / {day.sent}s
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Engagers</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-400 rounded" /> Drafts</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Sent</span>
              </div>
            </div>
          </div>
        )}

        {/* Top Countries */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Top Countries</h2>
          {stats?.topCountries && stats.topCountries.length > 0 ? (
            <div className="space-y-3">
              {stats.topCountries.map((c) => (
                <div key={c.country} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{c.country}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (c.count / (stats.topCountries[0]?.count || 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {c.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No engager data yet. Run a scrape to get started.</p>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Scrape Jobs</h2>
        {stats?.recentJobs && stats.recentJobs.length > 0 ? (
          <div className="space-y-3">
            {stats.recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.company.name}</p>
                  <p className="text-xs text-gray-500">
                    {job.currentStep || job.status} &middot;{" "}
                    {job.engagersFound} engagers, {job.draftsGenerated} drafts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  {job.status === "running" && (
                    <span className="text-xs text-blue-600">{job.progress}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No scrape jobs yet. Add a company and run a scrape.</p>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  highlight?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className={`text-sm mt-1 ${highlight ? "text-green-600 font-medium" : "text-gray-500"}`}>
        {sub}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  )
}
