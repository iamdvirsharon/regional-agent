"use client"

import { useEffect, useState } from "react"
import { Upload, ExternalLink, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { PrereqWarning } from "@/components/shared/PrereqWarning"
import { useStats } from "@/components/providers/StatsProvider"
import { StepBanner } from "@/components/shared/StepBanner"

interface ExportLogEntry {
  id: string
  sheetUrl: string | null
  countriesExported: string | null
  totalRows: number
  exportedAt: string
  scrapeJob: {
    company: { name: string }
  }
}

export default function ExportPage() {
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{
    sheetUrl: string
    countriesExported: string[]
    totalRows: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<ExportLogEntry[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const { stats } = useStats()

  async function fetchLogs() {
    try {
      const res = await fetch("/api/export")
      if (res.ok) setLogs(await res.json())
    } catch { /* ignore */ }
    setLoadingLogs(false)
  }

  useEffect(() => { fetchLogs() }, [])

  async function handleExport() {
    setExporting(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/export", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Export failed")
      }
      setResult(await res.json())
      fetchLogs()
    } catch (err) {
      setError(String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Export to Google Sheets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Exports run automatically after each scrape. Use Re-export for manual runs.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {exporting ? "Exporting..." : "Re-export Now"}
        </button>
      </div>

      {/* Prereq Warning */}
      {stats && !stats.setupStatus.hasExportKeys && (
        <PrereqWarning
          message="Google Sheets export requires a service account email and sheet ID. Configure them in Settings."
          linkLabel="Go to Settings"
          href="/settings"
        />
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Export Successful</h3>
              <p className="text-sm text-green-700 mt-1">
                Exported {result.totalRows} rows across {result.countriesExported.length} countries
              </p>
              {result.countriesExported.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.countriesExported.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{c}</span>
                  ))}
                </div>
              )}
              <a
                href={result.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline mt-3"
              >
                Open Google Sheet <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Export Failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Export History */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          Export History
        </h2>
        {loadingLogs ? (
          <div className="animate-pulse h-20 bg-gray-100 rounded" />
        ) : logs.length === 0 ? (
          <div className="py-8 text-center">
            <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900">No exports yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Export drafts to Google Sheets for your BDR team, organized by country. Exports also run automatically after each scrape.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              const countries = log.countriesExported ? JSON.parse(log.countriesExported) : []
              return (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.totalRows} rows exported
                      <span className="text-gray-500 font-normal"> from {log.scrapeJob.company.name}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {countries.map((c: string) => (
                        <span key={c} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {new Date(log.exportedAt).toLocaleString()}
                    </span>
                    {log.sheetUrl && (
                      <a
                        href={log.sheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>

      <StepBanner
        currentStep={6}
        totalSteps={6}
        prevPage={{ label: "Drafts", href: "/drafts" }}
        nextPage={{ label: "Dashboard", href: "/" }}
      />
    </>
  )
}
