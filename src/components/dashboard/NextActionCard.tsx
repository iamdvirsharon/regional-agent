"use client"

import Link from "next/link"
import { ArrowRight, Settings, Building2, Play, MessageSquare, Upload } from "lucide-react"
import type { AppStats } from "@/components/providers/StatsProvider"

interface Action {
  icon: React.ElementType
  title: string
  description: string
  href: string
  ctaLabel: string
  color: string
}

function getNextAction(stats: AppStats): Action {
  const { setupStatus } = stats

  if (!setupStatus.hasBrightDataKey || !setupStatus.hasAnthropicKey) {
    return {
      icon: Settings,
      title: "Configure your API keys to get started",
      description: "You need Bright Data (for scraping) and Anthropic (for AI drafts) API keys before anything else.",
      href: "/settings",
      ctaLabel: "Go to Settings",
      color: "blue",
    }
  }

  if (stats.totalCompanies === 0 || stats.totalEmployees === 0) {
    return {
      icon: Building2,
      title: "Add your first company and executives",
      description: "Add your company's LinkedIn page and the LinkedIn profiles of executives whose post engagement you want to monitor.",
      href: "/companies",
      ctaLabel: "Add Company",
      color: "blue",
    }
  }

  if (!stats.recentJobs.some((j) => j.status === "completed")) {
    const isRunning = stats.recentJobs.some((j) => j.status === "running")
    if (isRunning) {
      const job = stats.recentJobs.find((j) => j.status === "running")!
      return {
        icon: Play,
        title: `Scrape in progress: ${job.progress}%`,
        description: `Currently ${job.currentStep || "processing"} for ${job.company.name}. This page auto-refreshes.`,
        href: "/companies",
        ctaLabel: "View Companies",
        color: "blue",
      }
    }
    return {
      icon: Play,
      title: "Run your first scrape",
      description: `You have ${stats.totalCompanies} companies with ${stats.totalEmployees} employees set up. Run a scrape to discover who's engaging with their posts.`,
      href: "/companies",
      ctaLabel: "Go to Companies",
      color: "green",
    }
  }

  if (stats.totalDrafts > 0) {
    const draftsReady = stats.funnel.totalDrafts - stats.funnel.exported - stats.funnel.sent
    if (draftsReady > 0) {
      return {
        icon: MessageSquare,
        title: `${draftsReady} outreach drafts ready`,
        description: "AI-generated personalized messages are ready for your BDR team. Review, edit, and copy them.",
        href: "/drafts",
        ctaLabel: "View Drafts",
        color: "purple",
      }
    }

    return {
      icon: Upload,
      title: "Pipeline is healthy",
      description: `${stats.totalEngagers} engagers, ${stats.totalDrafts} drafts generated. Last scrape: ${formatTimeAgo(stats.lastScrapeAt)}.`,
      href: "/drafts",
      ctaLabel: "View Drafts",
      color: "green",
    }
  }

  return {
    icon: Play,
    title: "Run a scrape to generate outreach drafts",
    description: "Click 'Run Scrape Now' above or go to Companies to scrape a specific company.",
    href: "/companies",
    ctaLabel: "Go to Companies",
    color: "blue",
  }
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const colorMap: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50",
  green: "border-green-200 bg-green-50",
  purple: "border-purple-200 bg-purple-50",
}
const btnColorMap: Record<string, string> = {
  blue: "bg-blue-600 hover:bg-blue-700",
  green: "bg-green-600 hover:bg-green-700",
  purple: "bg-purple-600 hover:bg-purple-700",
}

export function NextActionCard({ stats }: { stats: AppStats }) {
  const action = getNextAction(stats)

  return (
    <div className={`rounded-xl border p-5 flex items-center gap-4 ${colorMap[action.color]}`}>
      <action.icon className="h-8 w-8 text-gray-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">{action.title}</h3>
        <p className="text-xs text-gray-600 mt-0.5">{action.description}</p>
      </div>
      <Link
        href={action.href}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg flex-shrink-0 ${btnColorMap[action.color]}`}
      >
        {action.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
