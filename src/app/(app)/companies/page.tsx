"use client"

import { useEffect, useState } from "react"
import { Building2, Plus, Users, Trash2, Play, Search, Upload } from "lucide-react"

interface Employee {
  id: string
  name: string
  role: string | null
  isActive: boolean
  lastScrapedAt: string | null
}

interface Company {
  id: string
  name: string
  linkedinUrl: string
  isActive: boolean
  createdAt: string
  employees: Employee[]
  scrapeJobs: {
    id: string
    status: string
    completedAt: string | null
    engagersFound: number
    postsFound: number
    draftsGenerated: number
  }[]
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [addEmployeeFor, setAddEmployeeFor] = useState<string | null>(null)
  const [bulkImportFor, setBulkImportFor] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState<string | null>(null)
  const [discoverResult, setDiscoverResult] = useState<string | null>(null)

  // Form state
  const [newCompany, setNewCompany] = useState({ name: "", linkedinUrl: "" })
  const [newEmployee, setNewEmployee] = useState({ name: "", linkedinUrl: "", role: "" })
  const [bulkText, setBulkText] = useState("")

  async function fetchCompanies() {
    const res = await fetch("/api/companies")
    setCompanies(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCompanies() }, [])

  async function addCompany(e: React.FormEvent) {
    e.preventDefault()
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCompany),
    })
    setNewCompany({ name: "", linkedinUrl: "" })
    setShowAddCompany(false)
    fetchCompanies()
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!addEmployeeFor) return
    await fetch(`/api/companies/${addEmployeeFor}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEmployee),
    })
    setNewEmployee({ name: "", linkedinUrl: "", role: "" })
    setAddEmployeeFor(null)
    fetchCompanies()
  }

  async function bulkImport(e: React.FormEvent) {
    e.preventDefault()
    if (!bulkImportFor || !bulkText.trim()) return

    const lines = bulkText.trim().split("\n").filter(Boolean)
    const employees = lines.map((line) => {
      const parts = line.split(",").map((s) => s.trim())
      return {
        name: parts[0] || "",
        linkedinUrl: parts[1] || "",
        role: parts[2] || "",
      }
    }).filter((e) => e.name && e.linkedinUrl)

    if (employees.length === 0) return

    await fetch(`/api/companies/${bulkImportFor}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employees),
    })
    setBulkText("")
    setBulkImportFor(null)
    fetchCompanies()
  }

  async function autoDiscover(companyId: string) {
    setDiscovering(companyId)
    setDiscoverResult(null)
    try {
      const res = await fetch(`/api/companies/${companyId}/employees`, { method: "PUT" })
      const data = await res.json()
      if (res.ok) {
        setDiscoverResult(`Found ${data.discovered} employees, added ${data.created} new`)
      } else {
        setDiscoverResult(data.error || "Discovery failed")
      }
      fetchCompanies()
    } catch {
      setDiscoverResult("Discovery failed - check BD config")
    } finally {
      setDiscovering(null)
      setTimeout(() => setDiscoverResult(null), 5000)
    }
  }

  async function deleteCompany(id: string) {
    if (!confirm("Delete this company and all its data?")) return
    await fetch(`/api/companies/${id}`, { method: "DELETE" })
    fetchCompanies()
  }

  async function triggerScrape(companyId: string) {
    await fetch("/api/scrape/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    })
    fetchCompanies()
  }

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-gray-200 rounded" /></div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitored Companies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add companies and their LinkedIn employee profiles to monitor engagement
          </p>
        </div>
        <button
          onClick={() => setShowAddCompany(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {/* Discover Result Toast */}
      {discoverResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg px-4 py-3">
          {discoverResult}
        </div>
      )}

      {/* Add Company Form */}
      {showAddCompany && (
        <form onSubmit={addCompany} className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold">Add New Company</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Company name (e.g., Bright Data)"
              value={newCompany.name}
              onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
              required
            />
            <input
              type="url"
              placeholder="LinkedIn company URL"
              value={newCompany.linkedinUrl}
              onChange={(e) => setNewCompany({ ...newCompany, linkedinUrl: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Save Company
            </button>
            <button type="button" onClick={() => setShowAddCompany(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Companies List */}
      <div className="space-y-4">
        {companies.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900">No companies yet</h3>
            <p className="text-sm text-gray-500 mt-1">Add a company to start monitoring LinkedIn engagement</p>
          </div>
        ) : (
          companies.map((company) => (
            <div key={company.id} className="bg-white rounded-xl border">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                    <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      {company.linkedinUrl}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerScrape(company.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                    >
                      <Play className="h-3 w-3" /> Scrape
                    </button>
                    <button
                      onClick={() => autoDiscover(company.id)}
                      disabled={discovering === company.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <Search className="h-3 w-3" />
                      {discovering === company.id ? "Discovering..." : "Auto-Discover"}
                    </button>
                    <button
                      onClick={() => setAddEmployeeFor(company.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                    <button
                      onClick={() => setBulkImportFor(company.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
                    >
                      <Upload className="h-3 w-3" /> Bulk
                    </button>
                    <button
                      onClick={() => deleteCompany(company.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Last job info */}
                {company.scrapeJobs[0] && (
                  <div className="text-xs text-gray-500 mb-4">
                    Last scrape: {company.scrapeJobs[0].status} &middot;{" "}
                    {company.scrapeJobs[0].postsFound} posts, {company.scrapeJobs[0].engagersFound} engagers, {company.scrapeJobs[0].draftsGenerated} drafts
                    {company.scrapeJobs[0].completedAt && (
                      <> &middot; {new Date(company.scrapeJobs[0].completedAt).toLocaleString()}</>
                    )}
                  </div>
                )}

                {/* Add Employee Form (inline) */}
                {addEmployeeFor === company.id && (
                  <form onSubmit={addEmployee} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <h4 className="text-sm font-medium">Add Employee Profile</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                        required
                      />
                      <input
                        type="url"
                        placeholder="LinkedIn profile URL"
                        value={newEmployee.linkedinUrl}
                        onChange={(e) => setNewEmployee({ ...newEmployee, linkedinUrl: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Role (e.g., CEO, VP Sales)"
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Add
                      </button>
                      <button type="button" onClick={() => setAddEmployeeFor(null)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Bulk Import Form */}
                {bulkImportFor === company.id && (
                  <form onSubmit={bulkImport} className="bg-purple-50 rounded-lg p-4 mb-4 space-y-3">
                    <h4 className="text-sm font-medium">Bulk Import Employees</h4>
                    <p className="text-xs text-gray-500">Paste one employee per line: Name, LinkedIn URL, Role</p>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={"John Doe, https://linkedin.com/in/johndoe, VP Sales\nJane Smith, https://linkedin.com/in/janesmith, Director"}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white h-28 font-mono"
                      required
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
                        Import {bulkText.trim().split("\n").filter(Boolean).length} employees
                      </button>
                      <button type="button" onClick={() => { setBulkImportFor(null); setBulkText("") }} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Employees */}
                {company.employees.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> Tracked Employees ({company.employees.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {company.employees.map((emp) => (
                        <div key={emp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.role || "No role set"}</p>
                          </div>
                          {emp.lastScrapedAt && (
                            <span className="text-xs text-gray-400">
                              {new Date(emp.lastScrapedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
