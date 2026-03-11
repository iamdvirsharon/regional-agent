"use client"

import { useEffect, useState, useCallback } from "react"
import { Settings, Plus, Check, Target, Save, Key, Eye, EyeOff, Trash2, Pencil } from "lucide-react"

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

interface ApiKeyInfo {
  key: string
  label: string
  description: string
  configured: boolean
  source: "database" | "environment" | null
  maskedValue: string | null
}

interface ApiKeyGroup {
  group: string
  keys: ApiKeyInfo[]
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

  // API Keys state
  const [apiKeyGroups, setApiKeyGroups] = useState<ApiKeyGroup[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys")
      const data = await res.json()
      setApiKeyGroups(data.groups || [])
    } catch {
      // ignore
    }
  }, [])

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

  useEffect(() => {
    fetchVoices()
    fetchIcp()
    fetchApiKeys()
  }, [fetchApiKeys])

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

  async function saveApiKey(keyName: string) {
    if (!editValue.trim()) return
    setSavingKey(keyName)
    await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyName, value: editValue.trim() }),
    })
    setSavingKey(null)
    setEditingKey(null)
    setEditValue("")
    fetchApiKeys()
  }

  async function deleteApiKey(keyName: string) {
    await fetch(`/api/settings/api-keys?key=${encodeURIComponent(keyName)}`, {
      method: "DELETE",
    })
    fetchApiKeys()
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure API keys, brand voice, and outreach parameters
        </p>
      </div>

      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        </div>
        <p className="text-sm text-gray-500">
          Add your API keys here. Keys saved in the app override environment variables.
        </p>

        {apiKeyGroups.map((group) => (
          <div key={group.group} className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              {group.group}
            </h3>
            <div className="space-y-3">
              {group.keys.map((apiKey) => (
                <div key={apiKey.key} className="flex items-center gap-3 py-2 border-b last:border-0 border-gray-50">
                  {/* Status dot */}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      apiKey.configured ? "bg-green-500" : "bg-gray-300"
                    }`}
                    title={apiKey.configured ? `Configured via ${apiKey.source}` : "Not configured"}
                  />

                  {/* Key info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{apiKey.label}</span>
                      {apiKey.source === "environment" && apiKey.configured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                          ENV
                        </span>
                      )}
                      {apiKey.source === "database" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                          SAVED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{apiKey.description}</p>
                  </div>

                  {/* Value / Edit */}
                  {editingKey === apiKey.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Paste API key..."
                        className="w-64 px-3 py-1.5 border rounded-lg text-sm font-mono"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveApiKey(apiKey.key)
                          if (e.key === "Escape") { setEditingKey(null); setEditValue("") }
                        }}
                      />
                      <button
                        onClick={() => saveApiKey(apiKey.key)}
                        disabled={!editValue.trim() || savingKey === apiKey.key}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingKey === apiKey.key ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setEditValue("") }}
                        className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {apiKey.maskedValue && (
                        <code className="text-xs text-gray-400 font-mono">
                          {showValues[apiKey.key] ? apiKey.maskedValue : "••••••••"}
                        </code>
                      )}
                      {apiKey.configured && (
                        <button
                          onClick={() => setShowValues((prev) => ({ ...prev, [apiKey.key]: !prev[apiKey.key] }))}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title={showValues[apiKey.key] ? "Hide" : "Show masked value"}
                        >
                          {showValues[apiKey.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingKey(apiKey.key); setEditValue("") }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title={apiKey.configured ? "Update key" : "Add key"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {apiKey.source === "database" && (
                        <button
                          onClick={() => deleteApiKey(apiKey.key)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Remove saved key (reverts to env variable)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {apiKeyGroups.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center">
            <Key className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading API key configuration...</p>
          </div>
        )}
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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
            Optional
          </span>
        </div>
        <form onSubmit={saveIcp} className="bg-white rounded-xl border p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Optionally define who your ideal leads are. The scoring engine can use this to prioritize engagers and filter out irrelevant ones.
            The app works fine without ICP configuration — all engagers will receive a default score.
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
    </div>
  )
}
