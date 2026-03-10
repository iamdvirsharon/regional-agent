"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, Loader2, CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronRight, Play } from "lucide-react"

interface EnrichmentList {
  id: string
  name: string
  provider: string
  status: string
  totalCount: number
  enrichedCount: number
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  _count: { engagers: number }
  statusCounts: {
    pending: number
    enriched: number
    failed: number
    not_found: number
  }
}

interface ListDetail {
  id: string
  name: string
  provider: string
  status: string
  engagers: {
    id: string
    status: string
    errorDetail: string | null
    engager: {
      id: string
      name: string
      linkedinUrl: string | null
      email: string | null
      currentTitle: string | null
      currentCompany: string | null
      country: string | null
      leadScore: number
      enriched: boolean
      source: string
    }
  }[]
}

const PROVIDER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  apollo: { bg: "bg-purple-100", text: "text-purple-700", label: "Apollo" },
  zoominfo: { bg: "bg-blue-100", text: "text-blue-700", label: "ZoomInfo" },
  leadiq: { bg: "bg-emerald-100", text: "text-emerald-700", label: "LeadIQ" },
}

export default function EnrichmentPage() {
  const [lists, setLists] = useState<EnrichmentList[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ListDetail | null>(null)

  const fetchLists = useCallback(async () => {
    const res = await fetch("/api/enrichment/lists")
    setLists(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  // Auto-refresh while processing
  useEffect(() => {
    const hasProcessing = lists.some((l) => l.status === "processing")
    if (!hasProcessing) return

    const interval = setInterval(fetchLists, 5000)
    return () => clearInterval(interval)
  }, [lists, fetchLists])

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    const res = await fetch(`/api/enrichment/lists/${id}`)
    setDetail(await res.json())
  }

  async function handleRun(id: string) {
    await fetch(`/api/enrichment/lists/${id}/run`, { method: "POST" })
    fetchLists()
  }

  function ProviderBadge({ provider }: { provider: string }) {
    const style = PROVIDER_STYLES[provider] || { bg: "bg-gray-100", text: "text-gray-700", label: provider }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    )
  }

  function StatusBadge({ status }: { status: string }) {
    switch (status) {
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium"><CheckCircle className="h-3 w-3" /> Completed</span>
      case "processing":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium"><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium"><Clock className="h-3 w-3" /> Pending</span>
      case "failed":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium"><XCircle className="h-3 w-3" /> Failed</span>
      default:
        return null
    }
  }

  function EngagerStatusBadge({ status }: { status: string }) {
    switch (status) {
      case "enriched":
        return <span className="text-green-600 text-xs">Enriched</span>
      case "not_found":
        return <span className="text-yellow-600 text-xs">Not found</span>
      case "failed":
        return <span className="text-red-600 text-xs">Failed</span>
      case "pending":
        return <span className="text-gray-400 text-xs">Pending</span>
      default:
        return null
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enrichment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enrich engager profiles with email, title, and company data via Apollo, ZoomInfo, or LeadIQ
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            To create an enrichment list, go to the <strong>Engagers</strong> page, select engagers using the checkboxes, and click &quot;Enrich&quot;.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">No enrichment lists yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Select engagers from the Engagers page to create your first list
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="bg-white rounded-xl border">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50"
                onClick={() => handleExpand(list.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedId === list.id ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{list.name}</h3>
                      <ProviderBadge provider={list.provider} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {list.totalCount} engagers &middot; {list.statusCounts.enriched} enriched
                      {list.statusCounts.not_found > 0 && ` \u00b7 ${list.statusCounts.not_found} not found`}
                      {list.statusCounts.failed > 0 && ` \u00b7 ${list.statusCounts.failed} failed`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={list.status} />
                  {list.status === "pending" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRun(list.id) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                      <Play className="h-3 w-3" /> Run Enrichment
                    </button>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(list.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {expandedId === list.id && detail && (
                <div className="border-t px-5 pb-5">
                  <table className="w-full mt-3">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Source</th>
                        <th className="text-left py-2">Email</th>
                        <th className="text-left py-2">Title</th>
                        <th className="text-left py-2">Company</th>
                        <th className="text-left py-2">Score</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.engagers.map((entry) => (
                        <tr key={entry.id} className="text-sm">
                          <td className="py-2">
                            {entry.engager.linkedinUrl ? (
                              <a href={entry.engager.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {entry.engager.name}
                              </a>
                            ) : (
                              <span>{entry.engager.name}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${entry.engager.source === "youtube" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                              {entry.engager.source}
                            </span>
                          </td>
                          <td className="py-2 text-xs font-mono">{entry.engager.email || "\u2014"}</td>
                          <td className="py-2 text-xs">{entry.engager.currentTitle || "\u2014"}</td>
                          <td className="py-2 text-xs">{entry.engager.currentCompany || "\u2014"}</td>
                          <td className="py-2 text-xs">{entry.engager.leadScore}</td>
                          <td className="py-2"><EngagerStatusBadge status={entry.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
