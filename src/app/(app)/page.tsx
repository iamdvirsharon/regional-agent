"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  MessageSquare,
  Mail,
  Zap,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  ArrowRight,
  Clock,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useStats } from "@/components/providers/StatsProvider"

export default function DashboardPage() {
  const { stats, loading, refresh } = useStats()

  // Quick Scrape state
  const [quickUrl, setQuickUrl] = useState("")
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickJobId, setQuickJobId] = useState<string | null>(null)
  const [quickStatus, setQuickStatus] = useState<{ progress: number; step: string; status: string } | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickResult, setQuickResult] = useState<{ engagers: number; drafts: number } | null>(null)

  async function handleQuickScrape(e: React.FormEvent) {
    e.preventDefault()
    if (!quickUrl.trim()) return
    setQuickLoading(true)
    setQuickError(null)
    setQuickResult(null)
    setQuickStatus(null)

    try {
      const res = await fetch("/api/scrape/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl: quickUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setQuickError(data.error || "Failed to start quick scrape")
        setQuickLoading(false)
        return
      }
      setQuickJobId(data.jobId)
    } catch {
      setQuickError("Failed to connect to server")
      setQuickLoading(false)
    }
  }

  // Poll quick scrape job progress
  const pollJob = useCallback(async () => {
    if (!quickJobId) return
    try {
      const res = await fetch(`/api/scrape/quick?jobId=${quickJobId}`)
      if (!res.ok) return
      const data = await res.json()
      setQuickStatus({ progress: data.progress, step: data.currentStep, status: data.status })

      if (data.status === "completed") {
        setQuickResult({ engagers: data.engagersFound, drafts: data.draftsGenerated })
        setQuickLoading(false)
        setQuickJobId(null)
        setQuickUrl("")
        refresh()
      } else if (data.status === "failed") {
        setQuickError(data.errorMessage || "Scrape job failed")
        setQuickLoading(false)
        setQuickJobId(null)
      }
    } catch { /* ignore */ }
  }, [quickJobId, refresh])

  useEffect(() => {
    if (!quickJobId) return
    const interval = setInterval(pollJob, 3000)
    pollJob()
    return () => clearInterval(interval)
  }, [quickJobId, pollJob])

  if (loading || !stats) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const hasData = stats.totalEngagers > 0
  const completedJobs = stats.recentJobs?.filter((j) => j.status === "completed") || []
  // Only show running jobs as "active" — queued jobs are just waiting and not interesting
  const activeJobs = stats.recentJobs?.filter((j) => j.status === "running") || []

  return (
    <div className="p-8 space-y-6">
      {/* ─── Quick Scrape: The Hero ─── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Zap className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold">Quick Scrape</h1>
          </div>
          <p className="text-blue-100 text-sm mb-5">
            Paste a LinkedIn post URL. We&apos;ll find everyone who engaged, enrich their profiles, and generate personalized outreach drafts &mdash; automatically.
          </p>
          <form onSubmit={handleQuickScrape} className="flex gap-3">
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="https://www.linkedin.com/posts/..."
              className="flex-1 px-4 py-3 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 bg-white border-0 focus:ring-2 focus:ring-white/50 shadow-lg"
              required
              disabled={quickLoading}
            />
            <button
              type="submit"
              disabled={quickLoading || !quickUrl.trim()}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-white text-blue-700 rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
            >
              {quickLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scraping...</>
              ) : (
                <><Play className="h-4 w-4" /> Scrape Engagers</>
              )}
            </button>
          </form>

          {/* Progress */}
          {quickLoading && (
            <div className="mt-5 bg-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-blue-100 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {quickStatus?.step || "Starting up — connecting to Bright Data..."}
                </span>
                <span className="text-blue-200 font-medium">{quickStatus?.progress || 0}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2.5">
                <div
                  className="bg-white rounded-full h-2.5 transition-all duration-700 ease-out"
                  style={{ width: `${quickStatus?.progress || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {quickResult && (
            <div className="mt-5 bg-green-500/20 border border-green-400/30 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-green-100">Scrape complete!</p>
                <p className="text-green-200 mt-1">
                  Found <strong>{quickResult.engagers}</strong> engagers and generated <strong>{quickResult.drafts}</strong> outreach drafts.
                </p>
                <div className="flex gap-3 mt-3">
                  <Link href="/engagers" className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors">
                    View Engagers <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link href="/drafts" className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors">
                    View Drafts <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {quickError && (
            <div className="mt-5 bg-red-500/20 border border-red-400/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-red-200">Something went wrong</p>
                <p className="text-red-300 mt-0.5">{quickError}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Stats Row (only show when there's data) ─── */}
      {hasData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/engagers" className="bg-white rounded-xl border p-5 hover:border-blue-200 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-500">Engagers</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalEngagers.toLocaleString()}</p>
            {stats.engagersToday > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">+{stats.engagersToday} today</p>
            )}
          </Link>

          <Link href="/drafts" className="bg-white rounded-xl border p-5 hover:border-purple-200 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-500">Outreach Drafts</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalDrafts.toLocaleString()}</p>
            {stats.draftsToday > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">+{stats.draftsToday} today</p>
            )}
          </Link>

          <Link href="/enrichment" className="bg-white rounded-xl border p-5 hover:border-amber-200 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-gray-500">Email Coverage</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.engagersWithEmail}</p>
            <p className="text-sm text-gray-500 mt-1">{stats.emailCoverage}% of engagers</p>
          </Link>
        </div>
      ) : (
        /* Empty state — guide the user */
        <div className="bg-white rounded-xl border p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Get started in seconds</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Paste a LinkedIn post URL in the Quick Scrape box above. The system will find all engagers, enrich their profiles, and generate personalized outreach drafts.
            </p>
            <div className="flex items-center justify-center gap-6 mt-5 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Paste URL
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Find engagers
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                Get drafts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Active Jobs (only show if running/queued) ─── */}
      {activeJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Active Jobs
          </h2>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {job.company?.name || (
                        <span className="inline-flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5 text-blue-600" /> Quick Scrape
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{job.currentStep || "Waiting to start..."}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {job.status === "running" && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-blue-100 rounded-full h-1.5">
                        <div className="bg-blue-600 rounded-full h-1.5 transition-all" style={{ width: `${job.progress}%` }} />
                      </div>
                      <span className="text-xs text-blue-600 font-medium">{job.progress}%</span>
                    </div>
                  )}
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Conversion Funnel + Top Countries (only when there's real data) ─── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel */}
          {stats.funnel && stats.funnel.totalEngagers > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Conversion Funnel
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Engagers found", value: stats.funnel.totalEngagers, color: "bg-blue-500" },
                  { label: "Drafts generated", value: stats.funnel.totalDrafts, color: "bg-purple-500" },
                  { label: "Exported", value: stats.funnel.exported, color: "bg-indigo-500" },
                  { label: "Sent", value: stats.funnel.sent, color: "bg-green-500" },
                  { label: "Replied", value: stats.funnel.replied, color: "bg-emerald-500" },
                ].map((step) => {
                  const pct = stats.funnel.totalEngagers > 0
                    ? Math.round((step.value / stats.funnel.totalEngagers) * 100)
                    : 0
                  return (
                    <div key={step.label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28">{step.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${step.color} h-2 rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">{step.value}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Countries */}
          {stats.topCountries && stats.topCountries.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Top Countries</h2>
              <div className="space-y-3">
                {stats.topCountries.map((c) => (
                  <div key={c.country} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-28 truncate">{c.country}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(c.count / (stats.topCountries[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Recent Completed Jobs ─── */}
      {completedJobs.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Recent Completed Scrapes
          </h2>
          <div className="divide-y">
            {completedJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {job.company?.name || (
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-blue-600" /> Quick Scrape
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {job.engagersFound} engagers &middot; {job.draftsGenerated} drafts
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    queued: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Queued" },
    running: { bg: "bg-blue-50", text: "text-blue-700", label: "Running" },
    completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
    failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  }

  const c = config[status] || { bg: "bg-gray-50", text: "text-gray-700", label: status }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
