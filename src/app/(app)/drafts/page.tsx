"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Copy, Check, ExternalLink, Search, Star, Mail, Video } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { PrereqWarning } from "@/components/shared/PrereqWarning"
import { useStats } from "@/components/providers/StatsProvider"
import { StepBanner } from "@/components/shared/StepBanner"

interface Draft {
  id: string
  icebreaker: string
  fullDraft: string
  editedDraft: string | null
  channel: string
  emailSubject: string | null
  emailDraft: string | null
  editedEmailDraft: string | null
  status: string
  outcome: string | null
  bdrNotes: string | null
  generatedAt: string
  engager: {
    name: string
    currentTitle: string | null
    currentCompany: string | null
    country: string | null
    linkedinUrl: string | null
    email: string | null
    leadScore: number
    source: string
  }
  engagement: {
    type: string
    commentText: string | null
    source: string
    scrapedPost: {
      postText: string
      linkedinPostUrl: string
      employeeProfile: { name: string }
    } | null
    youtubeVideo: {
      title: string | null
      url: string
    } | null
  }
}

interface DraftsResponse {
  drafts: Draft[]
  total: number
  page: number
  totalPages: number
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-100 text-green-700" :
    score >= 40 ? "bg-yellow-100 text-yellow-700" :
    "bg-gray-100 text-gray-500"
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Star className="h-3 w-3" /> {score}
    </span>
  )
}

export default function DraftsPage() {
  const [data, setData] = useState<DraftsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("draft")
  const [channel, setChannel] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const { stats } = useStats()

  async function fetchDrafts() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: "20" })
    if (status) params.set("status", status)
    if (channel) params.set("channel", channel)
    if (search) params.set("search", search)
    const res = await fetch(`/api/drafts?${params}`)
    setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchDrafts() }, [page, status, channel, search])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  async function copyDraft(draft: Draft) {
    const text = draft.channel === "email"
      ? `Subject: ${draft.emailSubject || draft.icebreaker}\n\n${draft.editedEmailDraft || draft.emailDraft || draft.fullDraft}`
      : (draft.editedDraft || draft.fullDraft)
    await navigator.clipboard.writeText(text)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)

    await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent", sentAt: new Date().toISOString() }),
    })
  }

  function startEditing(draft: Draft) {
    setEditingId(draft.id)
    setEditText(
      draft.channel === "email"
        ? (draft.editedEmailDraft || draft.emailDraft || draft.fullDraft)
        : (draft.editedDraft || draft.fullDraft)
    )
  }

  async function saveEdit(draft: Draft) {
    const field = draft.channel === "email" ? "editedEmailDraft" : "editedDraft"
    await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: editText }),
    })
    setEditingId(null)
    fetchDrafts()
  }

  async function setOutcome(draftId: string, outcome: string) {
    await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    })
    fetchDrafts()
  }

  function getEngagementContext(draft: Draft): string {
    const eng = draft.engagement
    if (eng.source === "youtube" || eng.youtubeVideo) {
      return `on YouTube video: "${eng.youtubeVideo?.title || "a video"}"`
    }
    return `${eng.scrapedPost?.employeeProfile?.name || "Unknown"}'s post`
  }

  return (
    <>
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach Drafts</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-generated personalized messages — edit, copy, and track outcomes
        </p>
      </div>

      {/* Prereq Warning */}
      {stats && !stats.setupStatus.hasAnthropicKey && (
        <PrereqWarning
          message="Anthropic API key is required to generate AI outreach drafts. Configure it in Settings."
          linkLabel="Go to Settings"
          href="/settings"
        />
      )}

      {/* Search + Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, company, country..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border rounded-lg w-64"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1) }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </form>

        {/* Channel filter */}
        <div className="flex gap-1 border rounded-lg p-0.5">
          {[
            { value: "", label: "All" },
            { value: "linkedin", label: "LinkedIn DM" },
            { value: "email", label: "Email" },
          ].map((c) => (
            <button
              key={c.value}
              onClick={() => { setChannel(c.value); setPage(1) }}
              className={`px-3 py-1 text-xs rounded font-medium ${
                channel === c.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          {["draft", "exported", "sent", ""].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                status === s
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s || "All"} {s === "draft" && data ? `(${data.total})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Drafts */}
      <div className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
        ) : data?.drafts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            heading="No drafts found"
            description={search
              ? "Try a different search or clear your filters."
              : "Outreach drafts are generated automatically when you scrape a LinkedIn post. Go to the Dashboard and paste a post URL in Quick Scrape to get started."}
            primaryCTA={!search ? { label: "Go to Dashboard", href: "/" } : undefined}
          />
        ) : (
          data?.drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-xl border p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {draft.engager.linkedinUrl ? (
                      <a
                        href={draft.engager.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {draft.engager.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">{draft.engager.name}</span>
                    )}
                    <ScoreBadge score={draft.engager.leadScore} />
                    {/* Channel badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      draft.channel === "email" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {draft.channel === "email" ? <><Mail className="h-3 w-3" /> Email</> : "LinkedIn DM"}
                    </span>
                    {/* Source badge */}
                    {draft.engager.source === "youtube" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-medium">
                        <Video className="h-3 w-3" /> YouTube
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {draft.engager.currentTitle} at {draft.engager.currentCompany}
                    </span>
                    {draft.engager.country && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {draft.engager.country}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {draft.engagement.type === "comment" ? "Commented" : "Liked"}{" "}
                    {getEngagementContext(draft)}
                    {draft.engagement.commentText && (
                      <>: &ldquo;{draft.engagement.commentText.slice(0, 100)}&rdquo;</>
                    )}
                  </p>
                  {draft.engager.email && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{draft.engager.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {draft.engager.linkedinUrl && draft.channel === "linkedin" && (
                    <a
                      href={draft.engager.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      Open LinkedIn
                    </a>
                  )}
                  <button
                    onClick={() => copyDraft(draft)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    {copiedId === draft.id ? (
                      <><Check className="h-3 w-3" /> Copied!</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy {draft.channel === "email" ? "Email" : "DM"}</>
                    )}
                  </button>
                </div>
              </div>

              {/* Draft Content */}
              <div className={`rounded-lg p-4 ${draft.channel === "email" ? "bg-orange-50" : "bg-blue-50"}`}>
                {draft.channel === "email" ? (
                  <>
                    <p className="text-sm font-medium text-orange-900 mb-1">Subject:</p>
                    <p className="text-sm text-orange-800 font-medium mb-3">{draft.emailSubject || draft.icebreaker}</p>
                    <hr className="border-orange-200 mb-3" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-orange-900">Email Body:</p>
                      {editingId !== draft.id && (
                        <button onClick={() => startEditing(draft)} className="text-xs text-orange-600 hover:underline">Edit</button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-blue-900 mb-2">Icebreaker:</p>
                    <p className="text-sm text-blue-800 italic">{draft.icebreaker}</p>
                    <hr className="my-3 border-blue-200" />
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-blue-900">Full Draft:</p>
                      {editingId !== draft.id && (
                        <button onClick={() => startEditing(draft)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      )}
                    </div>
                  </>
                )}
                {editingId === draft.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className={`w-full text-sm bg-white border rounded-lg p-3 min-h-[120px] ${
                        draft.channel === "email" ? "text-orange-800 border-orange-200" : "text-blue-800 border-blue-200"
                      }`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(draft)}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm whitespace-pre-wrap ${draft.channel === "email" ? "text-orange-800" : "text-blue-800"}`}>
                    {draft.channel === "email"
                      ? (draft.editedEmailDraft || draft.emailDraft || draft.fullDraft)
                      : (draft.editedDraft || draft.fullDraft)}
                    {(draft.editedDraft || draft.editedEmailDraft) && (
                      <span className="text-xs opacity-60 ml-2">(edited)</span>
                    )}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                <span className="text-xs text-gray-400">
                  Generated {new Date(draft.generatedAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  {draft.status === "sent" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Outcome:</span>
                      {["replied", "connected", "ignored"].map((o) => (
                        <button
                          key={o}
                          onClick={() => setOutcome(draft.id, o)}
                          className={`px-2 py-0.5 text-xs rounded font-medium ${
                            draft.outcome === o
                              ? o === "replied" ? "bg-green-100 text-green-700" :
                                o === "connected" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-200 text-gray-600"
                              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    draft.status === "sent" ? "bg-green-100 text-green-700" :
                    draft.status === "exported" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {draft.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
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

      <StepBanner
        currentStep={5}
        totalSteps={6}
        prevPage={{ label: "Enrichment", href: "/enrichment" }}
        nextPage={{ label: "Export", href: "/export" }}
        nextReady={(data?.total ?? 0) > 0}
      />
    </>
  )
}
