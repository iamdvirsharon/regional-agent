"use client"

import { useEffect, useState } from "react"
import { Settings, Plus, Check, Target, Save } from "lucide-react"

interface ICPConfig {
  id: string
  name: string
  targetTitles: string | null
  excludeTitles: string | null
  excludeCompanies: string | null
  targetCountries: string | null
  minLeadScore: number
  isActive: boolean
}

interface BrandVoice {
  id: string
  name: string
  companyName: string
  guidelines: string
  tone: string | null
  doRules: string | null
  dontRules: string | null
  isDefault: boolean
}

export default function SettingsPage() {
  const [voices, setVoices] = useState<BrandVoice[]>([])
  const [icpConfigs, setIcpConfigs] = useState<ICPConfig[]>([])
  const [icpForm, setIcpForm] = useState({
    name: "Default",
    targetTitles: "",
    excludeTitles: "",
    excludeCompanies: "",
    targetCountries: "",
    minLeadScore: 20,
  })
  const [savingIcp, setSavingIcp] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: "",
    companyName: "Bright Data",
    guidelines: "",
    tone: "",
    doRules: "",
    dontRules: "",
    isDefault: true,
  })

  async function fetchVoices() {
    const res = await fetch("/api/settings/brand-voice")
    setVoices(await res.json())
  }

  async function fetchIcp() {
    const res = await fetch("/api/settings/icp")
    const data = await res.json()
    setIcpConfigs(data)
    if (data.length > 0) {
      const active = data.find((c: ICPConfig) => c.isActive) || data[0]
      setIcpForm({
        name: active.name,
        targetTitles: active.targetTitles ? JSON.parse(active.targetTitles).join(", ") : "",
        excludeTitles: active.excludeTitles ? JSON.parse(active.excludeTitles).join(", ") : "",
        excludeCompanies: active.excludeCompanies ? JSON.parse(active.excludeCompanies).join(", ") : "",
        targetCountries: active.targetCountries ? JSON.parse(active.targetCountries).join(", ") : "",
        minLeadScore: active.minLeadScore,
      })
    }
  }

  async function saveIcp(e: React.FormEvent) {
    e.preventDefault()
    setSavingIcp(true)
    await fetch("/api/settings/icp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...icpForm,
        targetTitles: icpForm.targetTitles || undefined,
        excludeTitles: icpForm.excludeTitles || undefined,
        excludeCompanies: icpForm.excludeCompanies || undefined,
        targetCountries: icpForm.targetCountries || undefined,
      }),
    })
    setSavingIcp(false)
    fetchIcp()
  }

  useEffect(() => { fetchVoices(); fetchIcp() }, [])

  async function saveBrandVoice(e: React.FormEvent) {
    e.preventDefault()
    await fetch("/api/settings/brand-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ name: "", companyName: "Bright Data", guidelines: "", tone: "", doRules: "", dontRules: "", isDefault: true })
    fetchVoices()
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure brand voice and outreach parameters
        </p>
      </div>

      {/* Brand Voice Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Brand Voice</h2>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Brand Voice
          </button>
        </div>

        {showForm && (
          <form onSubmit={saveBrandVoice} className="bg-white rounded-xl border p-6 space-y-4">
            <h3 className="font-semibold">New Brand Voice</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Voice name (e.g., Professional Warm)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm"
                required
              />
              <input
                type="text"
                placeholder="Company name"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm"
                required
              />
            </div>
            <textarea
              placeholder="Brand voice guidelines - describe the tone, style, and personality of your outreach messages..."
              value={form.guidelines}
              onChange={(e) => setForm({ ...form, guidelines: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm h-32"
              required
            />
            <input
              type="text"
              placeholder="Tone (e.g., professional yet approachable, data-driven, consultative)"
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <div className="grid grid-cols-2 gap-4">
              <textarea
                placeholder="DO rules (one per line)&#10;- Always reference their specific engagement&#10;- Be genuine and conversational"
                value={form.doRules}
                onChange={(e) => setForm({ ...form, doRules: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm h-24"
              />
              <textarea
                placeholder="DON'T rules (one per line)&#10;- Don't be pushy or salesy&#10;- Don't use generic openers"
                value={form.dontRules}
                onChange={(e) => setForm({ ...form, dontRules: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm h-24"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Set as default voice
              </label>
              <div className="flex-1" />
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Save Brand Voice
              </button>
            </div>
          </form>
        )}

        {/* Existing Voices */}
        {voices.length === 0 && !showForm ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900">No brand voice configured</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add a brand voice to customize how outreach drafts are generated
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {voices.map((voice) => (
              <div key={voice.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{voice.name}</h3>
                    {voice.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">
                        <Check className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{voice.companyName}</span>
                </div>
                <p className="text-sm text-gray-600">{voice.guidelines}</p>
                {voice.tone && (
                  <p className="text-xs text-gray-500 mt-2">Tone: {voice.tone}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ICP Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Ideal Customer Profile (ICP)</h2>
        </div>
        <form onSubmit={saveIcp} className="bg-white rounded-xl border p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Define who your ideal leads are. The scoring engine uses this to prioritize engagers and skip irrelevant ones.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Titles</label>
              <input
                type="text"
                placeholder="VP, Director, Head of, CTO"
                value={icpForm.targetTitles}
                onChange={(e) => setIcpForm({ ...icpForm, targetTitles: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated. These get a scoring bonus.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exclude Titles</label>
              <input
                type="text"
                placeholder="Student, Intern, Recruiter"
                value={icpForm.excludeTitles}
                onChange={(e) => setIcpForm({ ...icpForm, excludeTitles: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated. These get score = 0, no draft.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exclude Companies</label>
              <input
                type="text"
                placeholder="Competitor A, Competitor B"
                value={icpForm.excludeCompanies}
                onChange={(e) => setIcpForm({ ...icpForm, excludeCompanies: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated. Skip engagers from these companies.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Countries</label>
              <input
                type="text"
                placeholder="United States, United Kingdom, Germany"
                value={icpForm.targetCountries}
                onChange={(e) => setIcpForm({ ...icpForm, targetCountries: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated. Priority countries for outreach.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Lead Score: {icpForm.minLeadScore}
            </label>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={icpForm.minLeadScore}
              onChange={(e) => setIcpForm({ ...icpForm, minLeadScore: parseInt(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Only generate outreach drafts for engagers scoring above this threshold.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingIcp}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingIcp ? "Saving..." : "Save ICP Config"}
            </button>
          </div>
        </form>
      </div>

      {/* Environment Info */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Checklist</h2>
        <div className="space-y-2 text-sm">
          <ConfigItem label="BRIGHT_DATA_API_KEY" description="Required for LinkedIn scraping" />
          <ConfigItem label="BRIGHT_DATA_LIKERS_DATASET" description="Optional — enables post liker collection" />
          <ConfigItem label="BRIGHT_DATA_COMPANY_DATASET" description="Optional — enables auto-discover employees" />
          <ConfigItem label="BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET" description="Required for YouTube comment scraping" />
          <ConfigItem label="ANTHROPIC_API_KEY" description="Required for AI draft generation" />
          <ConfigItem label="APOLLO_API_KEY" description="Apollo.io people enrichment" />
          <ConfigItem label="ZOOMINFO_CLIENT_ID" description="ZoomInfo enrichment (client ID)" />
          <ConfigItem label="ZOOMINFO_PRIVATE_KEY" description="ZoomInfo enrichment (private key)" />
          <ConfigItem label="LEADIQ_API_KEY" description="LeadIQ people enrichment" />
          <ConfigItem label="GOOGLE_SERVICE_ACCOUNT_EMAIL" description="Required for Sheets export" />
          <ConfigItem label="GOOGLE_SERVICE_ACCOUNT_KEY" description="Required for Sheets export" />
          <ConfigItem label="GOOGLE_SHEET_ID" description="Target spreadsheet for BDR delivery" />
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Configure these in your .env.local file. See .env.example for all options.
        </p>
      </div>
    </div>
  )
}

function ConfigItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{label}</code>
        <span className="text-xs text-gray-500 ml-2">{description}</span>
      </div>
    </div>
  )
}
