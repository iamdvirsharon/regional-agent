"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

export interface SetupStatus {
  hasBrightDataKey: boolean
  hasAnthropicKey: boolean
  hasBrandVoice: boolean
  hasEnrichmentKey: boolean
  hasExportKeys: boolean
}

export interface AppStats {
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
  totalYouTubeVideos: number
  youtubeEngagers: number
  enrichedCount: number
  engagersWithEmail: number
  emailCoverage: number
  setupStatus: SetupStatus
  lastScrapeAt: string | null
}

interface StatsContextValue {
  stats: AppStats | null
  loading: boolean
  refresh: () => Promise<void>
}

const StatsContext = createContext<StatsContextValue>({
  stats: null,
  loading: true,
  refresh: async () => {},
})

export function useStats() {
  return useContext(StatsContext)
}

export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<AppStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/stats")
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <StatsContext.Provider value={{ stats, loading, refresh }}>
      {children}
    </StatsContext.Provider>
  )
}
