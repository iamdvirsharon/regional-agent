"use client"

import { useEffect, useState, useCallback } from "react"
import { Video, Plus, Loader2, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react"

interface YouTubeVideo {
  id: string
  url: string
  videoId: string
  title: string | null
  channelName: string | null
  totalComments: number
  createdAt: string
  scrapeJob: {
    id: string
    status: string
    progress: number
    currentStep: string | null
    engagersFound: number
    draftsGenerated: number
  } | null
  _count: { engagements: number }
}

export default function YouTubePage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState("")
  const [triggering, setTriggering] = useState(false)

  const fetchVideos = useCallback(async () => {
    const res = await fetch("/api/youtube")
    setVideos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  // Auto-refresh while any job is running
  useEffect(() => {
    const hasRunning = videos.some(
      (v) => v.scrapeJob && ["queued", "running"].includes(v.scrapeJob.status)
    )
    if (!hasRunning) return

    const interval = setInterval(fetchVideos, 5000)
    return () => clearInterval(interval)
  }, [videos, fetchVideos])

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim()) return

    setTriggering(true)
    const videoUrls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)

    await fetch("/api/youtube/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrls }),
    })

    setUrlInput("")
    setTriggering(false)
    fetchVideos()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this video and all its engagements?")) return
    await fetch(`/api/youtube/${id}`, { method: "DELETE" })
    fetchVideos()
  }

  function StatusBadge({ status }: { status: string }) {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">
            <CheckCircle className="h-3 w-3" /> Completed
          </span>
        )
      case "running":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin" /> Running
          </span>
        )
      case "queued":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium">
            <Clock className="h-3 w-3" /> Queued
          </span>
        )
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">YouTube Videos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scrape comments from YouTube videos to find potential leads
        </p>
      </div>

      {/* Add Videos Form */}
      <form onSubmit={handleTrigger} className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-red-600" />
          <h2 className="font-semibold text-gray-900">Add YouTube Videos</h2>
        </div>
        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={"Paste YouTube video URLs (one per line)\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
          className="w-full px-3 py-2 border rounded-lg text-sm h-28 font-mono"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={triggering || !urlInput.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {triggering ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Scraping...</>
            ) : (
              <><Video className="h-4 w-4" /> Add &amp; Scrape</>
            )}
          </button>
        </div>
      </form>

      {/* Videos Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">No YouTube videos yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Paste video URLs above to start scraping comments
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Video</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comments</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drafts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {videos.map((video) => (
                <tr key={video.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {video.title || video.videoId}
                    </a>
                    {video.channelName && (
                      <p className="text-xs text-gray-500">{video.channelName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{video.totalComments}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{video.scrapeJob?.engagersFound ?? video._count.engagements}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{video.scrapeJob?.draftsGenerated ?? 0}</td>
                  <td className="px-4 py-3">
                    {video.scrapeJob ? (
                      <div>
                        <StatusBadge status={video.scrapeJob.status} />
                        {video.scrapeJob.status === "running" && video.scrapeJob.currentStep && (
                          <p className="text-xs text-gray-500 mt-1">{video.scrapeJob.currentStep}</p>
                        )}
                        {video.scrapeJob.status === "running" && (
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${video.scrapeJob.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not scraped</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(video.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
