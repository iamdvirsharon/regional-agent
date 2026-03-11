"use client"

import { useEffect, useState } from "react"
import { Download, Upload, ExternalLink, CheckCircle, AlertCircle, Clock, FileSpreadsheet, Users, MessageSquare } from "lucide-react"
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
    company: { name: string } | null
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

  async function handleSheetsExport() {
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

  const hasData = stats && stats.totalEngagers > 0

  return (
    <>
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Download your data as CSV or export to Google Sheets
        </p>
      </div>

      {/* CSV Export — always available */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Download className="h-5 w-5 text-blue-600" />
          Download CSV
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Download your engagers and outreach drafts as CSV files. Open in Excel, Google Sheets, or any spreadsheet tool.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={hasData ? "/api/export/csv?type=engagers" : undefined}
            download={hasData ? true : undefined}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed transition ${
              hasData
                ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                : "border-gray-200 opacity-50 cursor-not-allowed"
            }`}
            onClick={(e) => { if (!hasData) e.preventDefault() }}
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Engagers</p>
              <p className="text-xs text-gray-500">
                {stats ? `${stats.totalEngagers} engagers` : "Loading..."}
              </p>
            </div>
            <Download className="h-4 w-4 text-gray-400 ml-auto" />
          </a>

          <a
            href={hasData ? "/api/export/csv?type=drafts" : undefined}
            download={hasData ? true : undefined}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed transition ${
              hasData
                ? "border-purple-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
                : "border-gray-200 opacity-50 cursor-not-allowed"
            }`}
            onClick={(e) => { if (!hasData) e.preventDefault() }}
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Outreach Drafts</p>
              <p className="text-xs text-gray-500">
                {stats ? `${stats.totalDrafts} drafts` : "Loading..."}
              </p>
            </div>
            <Download className="h-4 w-4 text-gray-400 ml-auto" />
          </a>
        </div>

        {!hasData && (
          <p className="text-xs text-gray-400 mt-3">
            Run a Quick Scrape from the Dashboard first to get data to export.
          </p>
        )}
      </div>

      {/* Google Sheets Export — optional */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Google Sheets
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
              Optional
            </span>
          </h2>
          {stats?.setupStatus.hasExportKeys && (
            <button
              onClick={handleSheetsExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export to Sheets"}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Auto-export drafts to Google Sheets for your BDR team, organized by country tabs.
        </p>

        {stats && !stats.setupStatus.hasExportKeys && (
          <PrereqWarning
            message="Google Sheets export requires a service account. Configure it in Settings → Google Sheets. Most users can just use CSV export above."
            linkLabel="Go to Settings"
            href="/settings"
          />
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 text-sm">Export Successful</h3>
                <p className="text-sm text-green-700 mt-1">
                  Exported {result.totalRows} rows across {result.countriesExported.length} countries
                </p>
                <a
                  href={result.sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline mt-2"
                >
                  Open Google Sheet <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 text-sm">Export Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Export History */}
        {logs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Export History
            </h3>
            <div className="divide-y">
              {logs.map((log) => {
                const countries = log.countriesExported ? JSON.parse(log.countriesExported) : []
                return (
                  <div key={log.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {log.totalRows} rows exported
                        {log.scrapeJob?.company && (
                          <span className="text-gray-500 font-normal"> from {log.scrapeJob.company.name}</span>
                        )}
                      </p>
                      {countries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {countries.map((c: string) => (
                            <span key={c} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{c}</span>
                          ))}
                        </div>
                      )}
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
          </div>
        )}

        {loadingLogs && logs.length === 0 && (
          <div className="animate-pulse h-12 bg-gray-100 rounded" />
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
