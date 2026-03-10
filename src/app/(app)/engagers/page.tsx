"use client"

import { useEffect, useState } from "react"
import { Users, ExternalLink, Filter, Send, X, Video } from "lucide-react"

interface Engager {
  id: string
  name: string
  headline: string | null
  country: string | null
  city: string | null
  currentCompany: string | null
  currentTitle: string | null
  linkedinUrl: string | null
  email: string | null
  profileEnriched: boolean
  leadScore: number
  source: string
  enriched: boolean
  enrichmentProvider: string | null
  youtubeChannel: string | null
  createdAt: string
  engagements: {
    id: string
    type: string
    commentText: string | null
    source: string
    detectedAt: string
    scrapedPost: {
      linkedinPostUrl: string
      postText: string
      employeeProfile: { name: string }
    } | null
    youtubeVideo: {
      title: string | null
      url: string
    } | null
  }[]
  outreachDrafts: {
    id: string
    icebreaker: string
    status: string
    channel: string
  }[]
}

interface EngagersResponse {
  engagers: Engager[]
  total: number
  page: number
  totalPages: number
  countries: { country: string; count: number }[]
}

export default function EngagersPage() {
  const [data, setData] = useState<EngagersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState("")
  const [source, setSource] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showEnrichDialog, setShowEnrichDialog] = useState(false)
  const [enrichListName, setEnrichListName] = useState("")
  const [enrichProvider, setEnrichProvider] = useState("apollo")
  const [sending, setSending] = useState(false)

  async function fetchEngagers() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: "30", enriched: "true" })
    if (country) params.set("country", country)
    if (source) params.set("source", source)
    const res = await fetch(`/api/engagers?${params}`)
    setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchEngagers() }, [page, country, source])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (!data) return
    if (selected.size === data.engagers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.engagers.map((e) => e.id)))
    }
  }

  async function handleEnrich() {
    if (!enrichListName.trim() || selected.size === 0) return
    setSending(true)
    await fetch("/api/enrichment/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: enrichListName, engagerIds: Array.from(selected), provider: enrichProvider }),
    })
    setSending(false)
    setShowEnrichDialog(false)
    setEnrichListName("")
    setEnrichProvider("apollo")
    setSelected(new Set())
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Engagers</h1>
        <p className="text-sm text-gray-500 mt-1">
          People who engaged with your team&apos;s LinkedIn posts and YouTube videos
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1) }}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">All Countries</option>
            {data?.countries.map((c) => (
              <option key={c.country} value={c.country}>
                {c.country} ({c.count})
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1) }}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">All Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {data?.total || 0} engagers found
        </span>
      </div>

      {/* Selection Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-purple-800">{selected.size} selected</span>
          <button
            onClick={() => setShowEnrichDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            <Send className="h-3 w-3" /> Enrich
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* Enrich Dialog */}
      {showEnrichDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-4">
            <h3 className="font-semibold text-gray-900">Enrich Engagers</h3>
            <p className="text-sm text-gray-500">
              Create an enrichment list with {selected.size} engagers.
              The provider will find their email, LinkedIn URL, and other details.
            </p>
            <input
              type="text"
              placeholder="List name (e.g., YouTube leads - March)"
              value={enrichListName}
              onChange={(e) => setEnrichListName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={enrichProvider}
                onChange={(e) => setEnrichProvider(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="apollo">Apollo.io</option>
                <option value="zoominfo">ZoomInfo</option>
                <option value="leadiq">LeadIQ</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEnrichDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrich}
                disabled={!enrichListName.trim() || sending}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sending ? "Creating..." : "Create List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engagers Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={data?.engagers.length ? selected.size === data.engagers.length : false}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Score</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Title & Company</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Country</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Engagement</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Draft</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : data?.engagers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No engagers found. Run a scrape to discover engagement.</p>
                </td>
              </tr>
            ) : (
              data?.engagers.map((engager) => (
                <tr key={engager.id} className={`hover:bg-gray-50 ${selected.has(engager.id) ? "bg-purple-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(engager.id)}
                      onChange={() => toggleSelect(engager.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={engager.leadScore} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {engager.linkedinUrl ? (
                        <a
                          href={engager.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {engager.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{engager.name}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-xs ${engager.source === "youtube" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                        {engager.source === "youtube" ? <Video className="h-3 w-3 inline" /> : "LI"}
                      </span>
                      {engager.enriched && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-xs">
                          {engager.enrichmentProvider === "zoominfo" ? "ZI" : engager.enrichmentProvider === "leadiq" ? "LIQ" : "Apollo"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{engager.currentTitle || "—"}</p>
                    <p className="text-xs text-gray-500">{engager.currentCompany || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{engager.country || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 font-mono">{engager.email || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {engager.engagements[0] && (
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          engager.engagements[0].type === "comment"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {engager.engagements[0].type}
                        </span>
                        {engager.engagements[0].commentText && (
                          <p className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            &ldquo;{engager.engagements[0].commentText}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {engager.engagements[0].source === "youtube"
                            ? `on ${engager.engagements[0].youtubeVideo?.title || "YouTube video"}`
                            : `on ${engager.engagements[0].scrapedPost?.employeeProfile?.name || "Unknown"}'s post`}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {engager.outreachDrafts[0] ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        engager.outreachDrafts[0].status === "exported"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {engager.outreachDrafts[0].status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">pending</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(data.totalPages, page + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 40
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-500"
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${color}`}>
      {score}
    </span>
  )
}
