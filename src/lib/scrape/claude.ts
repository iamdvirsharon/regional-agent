// Claude AI outreach draft generation
// Reuses the Anthropic SDK pattern from az/src/lib/scan/claude.ts

import Anthropic from "@anthropic-ai/sdk"
import { getConfigValue } from "@/lib/config"

let _client: Anthropic | null = null

async function getClient(): Promise<Anthropic> {
  if (_client) return _client
  const apiKey = await getConfigValue("ANTHROPIC_API_KEY")
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured. Add it in Settings → API Keys.")
  _client = new Anthropic({ apiKey })
  return _client
}

// Reset client when key changes (called by config cache invalidation)
export function resetClaudeClient() {
  _client = null
}

export interface OutreachDraftResult {
  icebreaker: string
  fullDraft: string
}

export interface EmailDraftResult {
  subject: string
  body: string
}

export interface DraftContext {
  engagerName: string
  engagerTitle: string | null
  engagerCompany: string | null
  engagerCountry: string | null
  engagerAbout: string | null
  engagementType: "like" | "comment"
  commentText: string | null
  postText: string
  postAuthorName: string
  brandVoiceGuidelines: string
}

/**
 * Generate a personalized outreach draft for an engager.
 * Uses their engagement context + profile data to create a warm DM.
 */
export async function generateOutreachDraft(
  ctx: DraftContext
): Promise<OutreachDraftResult> {
  const client = await getClient()
  const model = (await getConfigValue("CLAUDE_MODEL")) || "claude-sonnet-4-6"

  const prompt = `You are a B2B sales development representative at Bright Data writing a personalized LinkedIn DM.

PROSPECT CONTEXT:
- Name: ${ctx.engagerName}
- Title: ${ctx.engagerTitle || "Unknown"}
- Company: ${ctx.engagerCompany || "Unknown"}
- Country: ${ctx.engagerCountry || "Unknown"}
- Bio: ${ctx.engagerAbout?.slice(0, 300) || "N/A"}

ENGAGEMENT CONTEXT:
- They ${ctx.engagementType === "comment" ? "commented on" : "liked"} a post by ${ctx.postAuthorName} (Bright Data team member)
- The post was about: "${ctx.postText.slice(0, 500)}"
${ctx.commentText ? `- Their comment: "${ctx.commentText.slice(0, 300)}"` : ""}

BRAND VOICE:
${ctx.brandVoiceGuidelines}

TASK:
Generate a warm, personalized LinkedIn DM outreach message.

RULES:
- Reference their SPECIFIC engagement (the post they interacted with, their comment if they commented)
- Keep it conversational and human - NOT salesy or pitch-heavy
- The goal is to start a genuine conversation, not to sell immediately
- Be concise (3-5 sentences max for the full draft)
- The icebreaker should be 1 sentence that hooks them based on their engagement
- Match the language/tone appropriate for their country and seniority level
- Do NOT use generic openers like "I noticed you..." or "Hope this finds you well"
- Do NOT mention Bright Data's products directly - focus on the conversation topic

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "icebreaker": "1-sentence conversation opener referencing their engagement",
  "fullDraft": "Full 3-5 sentence DM including the icebreaker"
}`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in Claude response")

    const parsed = JSON.parse(jsonMatch[0])
    return {
      icebreaker: parsed.icebreaker || "",
      fullDraft: parsed.fullDraft || parsed.full_draft || "",
    }
  } catch (error) {
    console.error("Claude outreach draft error:", error)
    return {
      icebreaker: `Saw your ${ctx.engagementType} on ${ctx.postAuthorName}'s post - great perspective!`,
      fullDraft: `Hey ${ctx.engagerName}, saw your ${ctx.engagementType} on ${ctx.postAuthorName}'s recent post about ${ctx.postText.slice(0, 100)}. Would love to connect and chat more about it!`,
    }
  }
}

/**
 * Generate drafts in batch for multiple engagers.
 * Processes sequentially to respect API rate limits.
 */
export async function generateOutreachDraftsBatch(
  contexts: DraftContext[],
  onProgress?: (completed: number, total: number) => void
): Promise<OutreachDraftResult[]> {
  const results: OutreachDraftResult[] = []

  for (let i = 0; i < contexts.length; i++) {
    const draft = await generateOutreachDraft(contexts[i])
    results.push(draft)

    if (onProgress) {
      onProgress(i + 1, contexts.length)
    }

    // Small delay between requests to avoid rate limiting
    if (i < contexts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Generate a personalized email outreach draft.
 * Used when engager's email is known (e.g., via Apollo enrichment).
 */
export async function generateEmailDraft(
  ctx: DraftContext
): Promise<EmailDraftResult> {
  const client = await getClient()
  const model = (await getConfigValue("CLAUDE_MODEL")) || "claude-sonnet-4-6"

  const prompt = `You are a B2B sales development representative at Bright Data writing a personalized cold outreach email.

PROSPECT CONTEXT:
- Name: ${ctx.engagerName}
- Title: ${ctx.engagerTitle || "Unknown"}
- Company: ${ctx.engagerCompany || "Unknown"}
- Country: ${ctx.engagerCountry || "Unknown"}
- Bio: ${ctx.engagerAbout?.slice(0, 300) || "N/A"}

ENGAGEMENT CONTEXT:
- They ${ctx.engagementType === "comment" ? "commented on" : "liked"} content by ${ctx.postAuthorName}
- The content was about: "${ctx.postText.slice(0, 500)}"
${ctx.commentText ? `- Their comment: "${ctx.commentText.slice(0, 300)}"` : ""}

BRAND VOICE:
${ctx.brandVoiceGuidelines}

TASK:
Generate a professional yet warm cold email.

RULES:
- Subject line: max 8 words, curiosity-driven, NOT clickbait
- Email body: 5-8 sentences
- Reference their specific engagement naturally
- Professional tone appropriate for email (slightly more formal than a DM)
- Include a clear but soft CTA (e.g., "Would you be open to a quick chat?")
- Do NOT use generic email openers like "I hope this email finds you well"
- Do NOT be pushy or overtly salesy
- Sign off with just a first name

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "subject": "Short email subject line",
  "body": "Full email body text"
}`

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in Claude response")

    const parsed = JSON.parse(jsonMatch[0])
    return {
      subject: parsed.subject || "",
      body: parsed.body || "",
    }
  } catch (error) {
    console.error("Claude email draft error:", error)
    return {
      subject: `Re: ${ctx.postText.slice(0, 40)}`,
      body: `Hi ${ctx.engagerName},\n\nI noticed your engagement with ${ctx.postAuthorName}'s content about ${ctx.postText.slice(0, 100)}. I'd love to connect and discuss this further.\n\nBest regards`,
    }
  }
}
