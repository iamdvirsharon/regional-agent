// Lead scoring module
// Scores engagers 0-100 based on seniority, engagement quality, repeat engagement, profile completeness

export interface ScoreInput {
  currentTitle: string | null
  currentCompany: string | null
  aboutText: string | null
  engagementType: "like" | "comment"
  commentText: string | null
  engagementCount: number
  // ICP matching (optional)
  icpTargetTitles?: string[]
  icpExcludeTitles?: string[]
  icpExcludeCompanies?: string[]
  // Source (optional)
  source?: "linkedin" | "youtube"
}

export interface ScoreResult {
  score: number
  factors: Record<string, number>
}

export function calculateLeadScore(input: ScoreInput): ScoreResult {
  const factors: Record<string, number> = {}
  const title = (input.currentTitle || "").toLowerCase()
  const company = (input.currentCompany || "").toLowerCase()

  // ── ICP Exclusions (instant zero) ──
  if (input.icpExcludeTitles?.length) {
    const excluded = input.icpExcludeTitles.some((t) =>
      title.includes(t.toLowerCase())
    )
    if (excluded) {
      return { score: 0, factors: { excluded: 0 } }
    }
  }

  if (input.icpExcludeCompanies?.length) {
    const excluded = input.icpExcludeCompanies.some((c) =>
      company.includes(c.toLowerCase())
    )
    if (excluded) {
      return { score: 0, factors: { excludedCompany: 0 } }
    }
  }

  // ── Seniority (0-35) ──
  if (/\b(ceo|cto|cfo|coo|cmo|cro|cpo|founder|co-founder|president|owner)\b/.test(title)) {
    factors.seniority = 35
  } else if (/\b(vp|vice president|svp|evp)\b/.test(title)) {
    factors.seniority = 30
  } else if (/\b(director|head of)\b/.test(title)) {
    factors.seniority = 25
  } else if (/\b(senior|sr\.?|lead|principal|staff)\b/.test(title)) {
    factors.seniority = 18
  } else if (/\b(manager|team lead)\b/.test(title)) {
    factors.seniority = 15
  } else if (/\b(analyst|specialist|consultant|engineer|developer)\b/.test(title)) {
    factors.seniority = 10
  } else {
    factors.seniority = 5
  }

  // ── ICP title bonus ──
  if (input.icpTargetTitles?.length) {
    const match = input.icpTargetTitles.some((t) =>
      title.includes(t.toLowerCase())
    )
    if (match) {
      factors.icpMatch = 10
    }
  }

  // ── Engagement quality (0-35) ──
  if (input.engagementType === "comment") {
    const len = (input.commentText || "").length
    if (len > 150) {
      factors.engagementQuality = 35
    } else if (len > 50) {
      factors.engagementQuality = 25
    } else {
      factors.engagementQuality = 15
    }
  } else {
    factors.engagementQuality = 5
  }

  // ── Repeat engagement (0-15) ──
  factors.repeatEngagement = Math.min(15, input.engagementCount * 5)

  // ── Profile completeness (0-15) ──
  factors.profileCompleteness = 0
  if (input.currentTitle) factors.profileCompleteness += 5
  if (input.currentCompany) factors.profileCompleteness += 5
  if (input.aboutText) factors.profileCompleteness += 5

  // ── YouTube source bonus (0-5) ──
  if (input.source === "youtube") {
    factors.youtubeBonus = 5
  }

  const score = Object.values(factors).reduce((sum, v) => sum + v, 0)
  return { score: Math.min(100, score), factors }
}
