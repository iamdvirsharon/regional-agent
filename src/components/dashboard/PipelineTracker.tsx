"use client"

import Link from "next/link"
import {
  Settings,
  Building2,
  Radar,
  Users,
  Search,
  MessageSquare,
  Check,
  ArrowRight,
} from "lucide-react"
import type { AppStats } from "@/components/providers/StatsProvider"

interface PipelineStep {
  label: string
  icon: React.ElementType
  href: string
  isComplete: boolean
  summary: string
  helpText: string
  optional?: boolean
}

function getSteps(stats: AppStats): PipelineStep[] {
  const { setupStatus } = stats
  const hasKeys = setupStatus.hasBrightDataKey && setupStatus.hasAnthropicKey
  const hasCompanies = stats.totalCompanies > 0 && stats.totalEmployees > 0
  const hasScrape = stats.recentJobs.some((j) => j.status === "completed")
  const hasEngagers = stats.totalEngagers > 0
  const hasEnriched = stats.enrichedCount > 0
  const hasDrafts = stats.totalDrafts > 0

  return [
    {
      label: "Configure",
      icon: Settings,
      href: "/settings",
      isComplete: hasKeys,
      summary: hasKeys
        ? "API keys configured"
        : "Add API keys",
      helpText: "Set up Bright Data + Anthropic API keys",
    },
    {
      label: "Companies",
      icon: Building2,
      href: "/companies",
      isComplete: hasCompanies,
      summary: hasCompanies
        ? `${stats.totalCompanies} companies, ${stats.totalEmployees} employees`
        : "Add company + executives",
      helpText: "Add your company and executive LinkedIn profiles",
    },
    {
      label: "Scrape",
      icon: Radar,
      href: "/companies",
      isComplete: hasScrape,
      summary: hasScrape
        ? `Last: ${formatTimeAgo(stats.lastScrapeAt)}`
        : "Run first scrape",
      helpText: "Scrape posts and find who engaged",
    },
    {
      label: "Engagers",
      icon: Users,
      href: "/engagers",
      isComplete: hasEngagers,
      summary: hasEngagers
        ? `${stats.totalEngagers.toLocaleString()} engagers`
        : "Waiting for scrape",
      helpText: "Review people who engaged with your posts",
    },
    {
      label: "Enrich",
      icon: Search,
      href: "/enrichment",
      isComplete: hasEnriched,
      summary: hasEnriched
        ? `${stats.enrichedCount} enriched`
        : "Not started yet",
      helpText: "Get emails & company data via Apollo/ZoomInfo",
      optional: true,
    },
    {
      label: "Drafts",
      icon: MessageSquare,
      href: "/drafts",
      isComplete: hasDrafts,
      summary: hasDrafts
        ? `${stats.totalDrafts} drafts ready`
        : "Generated after scrape",
      helpText: "AI-generated personalized outreach messages",
    },
  ]
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

export function PipelineTracker({ stats }: { stats: AppStats }) {
  const steps = getSteps(stats)
  const activeIndex = steps.findIndex((s) => !s.isComplete)

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Pipeline</h2>
      </div>
      <div className="flex items-start gap-1">
        {steps.map((step, i) => {
          const isActive = i === activeIndex
          const isPast = step.isComplete
          const isFuture = !step.isComplete && !isActive

          return (
            <div key={step.label} className="flex items-start flex-1 min-w-0">
              <Link href={step.href} className="flex flex-col items-center text-center w-full group">
                {/* Icon circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                    ${isPast ? "bg-green-100 text-green-600" : ""}
                    ${isActive ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300 ring-offset-2" : ""}
                    ${isFuture ? "bg-gray-100 text-gray-400" : ""}
                    group-hover:scale-110
                  `}
                >
                  {isPast ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-xs font-semibold ${isPast ? "text-green-700" : isActive ? "text-blue-700" : "text-gray-400"}`}>
                  {step.label}
                  {step.optional && (
                    <span className="text-[9px] ml-1 font-normal text-gray-400">(optional)</span>
                  )}
                </span>

                {/* Summary */}
                <span className={`text-[11px] mt-0.5 leading-tight ${isPast ? "text-green-600" : isActive ? "text-blue-600" : "text-gray-400"}`}>
                  {step.summary}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <span className="mt-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    Start here
                  </span>
                )}
              </Link>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="flex items-center pt-4 px-1 flex-shrink-0">
                  <ArrowRight className={`h-3.5 w-3.5 ${isPast ? "text-green-300" : "text-gray-200"}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
