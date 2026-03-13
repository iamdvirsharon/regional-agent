// Bright Data LinkedIn scraping layer
// BD is free (employee at Bright Data) — no artificial limits

import { getConfigValue } from "@/lib/config"

export interface LinkedInPost {
  url: string
  urn: string
  text: string
  datePosted: string | null
  numLikes: number
  numComments: number
  authorName: string
  authorUrl: string
}

export interface PostComment {
  commenterName: string
  commenterUrl: string
  commenterHeadline: string | null
  commentText: string
  timestamp: string | null
}

export interface PostLiker {
  likerName: string
  likerUrl: string
  likerHeadline: string | null
}

export interface CompanyEmployee {
  name: string
  profileUrl: string
  title: string | null
}

export interface LinkedInProfile {
  url: string
  name: string
  headline: string | null
  country: string | null
  city: string | null
  currentCompany: string | null
  currentTitle: string | null
  aboutText: string | null
  profileImageUrl: string | null
  followerCount: number | null
  connectionCount: number | null
}

export interface YouTubeComment {
  commentId: string
  commentText: string
  likesCount: number
  repliesCount: number
  username: string
  userChannelUrl: string
  datePosted: string | null
}

async function getApiKey(): Promise<string> {
  const apiKey = await getConfigValue("BRIGHT_DATA_API_KEY")
  if (!apiKey) throw new Error("BRIGHT_DATA_API_KEY not set. Add it in Settings → API Keys.")
  return apiKey
}

async function triggerDataset<T>(datasetId: string, input: unknown[], options?: { discover?: boolean }): Promise<T[]> {
  const apiKey = await getApiKey()

  // Only use discover params when discovering posts from a profile URL (not when fetching specific post/profile data)
  const discoverParams = options?.discover ? "&type=discover_new&discover_by=url" : ""

  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true${discoverParams}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[BD] Dataset ${datasetId} HTTP error ${res.status}:`, errorText)
    throw new Error(`Bright Data API error: ${res.status} - ${errorText}`)
  }

  const data = await res.json()
  console.log(`[BD] Dataset ${datasetId} response type: ${data.snapshot_id ? "snapshot" : "inline"}, keys: ${Object.keys(data).join(",")}`)

  // BD returns snapshot_id for async collection - need to poll for results
  if (data.snapshot_id) {
    console.log(`[BD] Polling snapshot ${data.snapshot_id}...`)
    return await pollSnapshot<T>(data.snapshot_id)
  }

  // Direct response — filter out error entries
  const rawResults = Array.isArray(data) ? data : data.results || []
  const filtered = rawResults.filter((item: Record<string, unknown>) => !item.error)
  console.log(`[BD] Inline results: ${rawResults.length} total, ${filtered.length} after filtering errors`)
  return filtered
}

async function pollSnapshot<T>(snapshotId: string, maxAttempts = 10): Promise<T[]> {
  const apiKey = await getApiKey()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5s between polls (10×5s = 50s max, fits Vercel 60s limit)

    const res = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (res.status === 202) {
      console.log(`Snapshot ${snapshotId} still processing (attempt ${attempt + 1}/${maxAttempts})`)
      continue
    }

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Snapshot poll error: ${res.status} - ${errorText}`)
    }

    const data = await res.json()
    const results = Array.isArray(data) ? data : []
    // Filter out entries that have error fields (dead pages, etc.)
    return results.filter((item: Record<string, unknown>) => !item.error)
  }

  throw new Error(`Snapshot ${snapshotId} timed out after ${maxAttempts} attempts`)
}

/**
 * Discover recent posts by a LinkedIn profile.
 */
export async function discoverPosts(
  profileUrl: string,
  numPosts: number = 20
): Promise<LinkedInPost[]> {
  const datasetId = (await getConfigValue("BRIGHT_DATA_POSTS_DATASET")) || "gd_lyy3tktm25m4avu764"

  const rawPosts = await triggerDataset<Record<string, unknown>>(datasetId, [
    { url: profileUrl },
  ], { discover: true })

  return rawPosts.map((post) => ({
    url: String(post.url || post.post_url || ""),
    urn: String(post.id || post.post_urn || post.urn || post.url || ""),
    text: String(post.post_text || post.text || post.content || ""),
    datePosted: post.date_posted ? String(post.date_posted) : post.timestamp ? String(post.timestamp) : null,
    numLikes: Number(post.num_likes || post.likes || 0),
    numComments: Number(post.num_comments || post.comments || 0),
    authorName: String(post.user_id || post.author_name || post.poster_name || ""),
    authorUrl: String(post.use_url || post.author_url || post.poster_url || profileUrl),
  }))
}

/**
 * Collect comments on a specific LinkedIn post.
 * Uses the LinkedIn Posts dataset — comments are embedded in the post response
 * as `top_visible_comments` or similar fields.
 */
export async function collectPostEngagement(
  postUrl: string
): Promise<PostComment[]> {
  // Use the same LinkedIn Posts dataset — it returns comments embedded in the post data
  const datasetId = (await getConfigValue("BRIGHT_DATA_POSTS_DATASET")) || "gd_lyy3tktm25m4avu764"

  const rawPosts = await triggerDataset<Record<string, unknown>>(datasetId, [
    { url: postUrl },
  ])

  if (rawPosts.length === 0) return []

  const post = rawPosts[0]

  // Extract comments from the post response
  // BD returns comments in `top_visible_comments` field with structure:
  // { use_url, user_id, user_name, comment, comment_date, num_reactions, user_title }
  const comments: PostComment[] = []

  const rawComments = (post.top_visible_comments || post.comments_list || post.comments || []) as Record<string, unknown>[]
  if (Array.isArray(rawComments)) {
    for (const comment of rawComments) {
      if (typeof comment === "object" && comment !== null) {
        // Build profile URL from use_url or user_id
        let profileUrl = String(comment.use_url || comment.commenter_url || comment.author_url || comment.profile_url || "")
        // BD sometimes returns company URLs — normalize LinkedIn profile URLs
        if (!profileUrl && comment.user_id) {
          profileUrl = `https://www.linkedin.com/in/${comment.user_id}`
        }

        comments.push({
          commenterName: String(comment.user_name || comment.commenter_name || comment.author_name || comment.name || "Unknown"),
          commenterUrl: profileUrl,
          commenterHeadline: comment.user_title ? String(comment.user_title) : comment.headline ? String(comment.headline) : null,
          commentText: String(comment.comment || comment.comment_text || comment.text || comment.content || ""),
          timestamp: comment.comment_date ? String(comment.comment_date) : comment.timestamp ? String(comment.timestamp) : null,
        })
      }
    }
  }

  console.log(`[BD] collectPostEngagement: ${rawPosts.length} posts returned, ${rawComments.length} raw comments, ${comments.length} parsed comments`)
  if (rawPosts.length > 0) {
    const postKeys = Object.keys(rawPosts[0]).join(",")
    console.log(`[BD] Post fields: ${postKeys.slice(0, 200)}`)
  }
  return comments
}

/**
 * Collect likers on a specific LinkedIn post.
 * Likers typically outnumber commenters 5-10x — big reach multiplier.
 */
export async function collectPostLikers(
  postUrl: string
): Promise<PostLiker[]> {
  const datasetId = await getConfigValue("BRIGHT_DATA_LIKERS_DATASET")
  if (!datasetId) {
    console.warn("BRIGHT_DATA_LIKERS_DATASET not configured, skipping likers collection")
    return []
  }

  const rawLikers = await triggerDataset<Record<string, unknown>>(datasetId, [
    { url: postUrl },
  ])

  return rawLikers.map((liker) => ({
    likerName: String(liker.name || liker.full_name || liker.liker_name || "Unknown"),
    likerUrl: String(liker.profile_url || liker.url || liker.liker_url || ""),
    likerHeadline: liker.headline ? String(liker.headline) : null,
  }))
}

/**
 * Auto-discover employees from a company LinkedIn page.
 * Uses BD Company/Employees dataset.
 */
export async function discoverCompanyEmployees(
  companyLinkedinUrl: string,
  limit: number = 50
): Promise<CompanyEmployee[]> {
  const datasetId = await getConfigValue("BRIGHT_DATA_COMPANY_DATASET")
  if (!datasetId) {
    throw new Error("BRIGHT_DATA_COMPANY_DATASET not configured")
  }

  const results = await triggerDataset<Record<string, unknown>>(datasetId, [
    { url: companyLinkedinUrl, num_of_employees: limit },
  ])

  return results
    .map((e) => ({
      name: String(e.name || e.full_name || ""),
      profileUrl: String(e.profile_url || e.linkedin_url || e.url || ""),
      title: e.title ? String(e.title) : e.current_title ? String(e.current_title) : null,
    }))
    .filter((e) => e.name && e.profileUrl)
}

/**
 * Enrich a LinkedIn profile with full details.
 */
export async function enrichProfile(
  profileUrl: string
): Promise<LinkedInProfile | null> {
  const datasetId = (await getConfigValue("BRIGHT_DATA_PROFILES_DATASET")) || "gd_l1viktl72bvl7bjuj0"

  try {
    const profiles = await triggerDataset<Record<string, unknown>>(datasetId, [
      { url: profileUrl },
    ])

    if (profiles.length === 0) return null

    const p = profiles[0]
    return {
      url: profileUrl,
      name: String(p.name || p.full_name || ""),
      headline: p.headline ? String(p.headline) : null,
      country: p.country ? String(p.country) : p.location?.toString().split(",").pop()?.trim() || null,
      city: p.city ? String(p.city) : p.location?.toString().split(",")[0]?.trim() || null,
      currentCompany: p.current_company ? String(p.current_company) : p.company ? String(p.company) : null,
      currentTitle: p.current_title ? String(p.current_title) : p.title ? String(p.title) : null,
      aboutText: p.about ? String(p.about) : p.summary ? String(p.summary) : null,
      profileImageUrl: p.profile_image_url ? String(p.profile_image_url) : p.avatar ? String(p.avatar) : null,
      followerCount: p.follower_count ? Number(p.follower_count) : null,
      connectionCount: p.connection_count ? Number(p.connection_count) : null,
    }
  } catch (error) {
    console.error(`Failed to enrich profile ${profileUrl}:`, error)
    return null
  }
}

/**
 * Enrich multiple profiles in a single batch request.
 */
export async function enrichProfilesBatch(
  profileUrls: string[]
): Promise<Map<string, LinkedInProfile>> {
  const datasetId = (await getConfigValue("BRIGHT_DATA_PROFILES_DATASET")) || "gd_l1viktl72bvl7bjuj0"
  const results = new Map<string, LinkedInProfile>()

  if (profileUrls.length === 0) return results

  try {
    const input = profileUrls.map((url) => ({ url }))
    const profiles = await triggerDataset<Record<string, unknown>>(datasetId, input)

    for (const p of profiles) {
      const url = String(p.url || p.profile_url || p.linkedin_url || "")
      if (!url) continue

      results.set(url, {
        url,
        name: String(p.name || p.full_name || ""),
        headline: p.headline ? String(p.headline) : null,
        country: p.country ? String(p.country) : null,
        city: p.city ? String(p.city) : null,
        currentCompany: p.current_company ? String(p.current_company) : p.company ? String(p.company) : null,
        currentTitle: p.current_title ? String(p.current_title) : p.title ? String(p.title) : null,
        aboutText: p.about ? String(p.about) : p.summary ? String(p.summary) : null,
        profileImageUrl: p.profile_image_url ? String(p.profile_image_url) : null,
        followerCount: p.follower_count ? Number(p.follower_count) : null,
        connectionCount: p.connection_count ? Number(p.connection_count) : null,
      })
    }
  } catch (error) {
    console.error("Batch profile enrichment failed:", error)
  }

  return results
}

/**
 * Collect comments from a YouTube video.
 */
export async function collectYouTubeComments(
  videoUrl: string
): Promise<YouTubeComment[]> {
  const datasetId = await getConfigValue("BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET")
  if (!datasetId) {
    throw new Error("BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET not configured")
  }

  const rawComments = await triggerDataset<Record<string, unknown>>(datasetId, [
    { url: videoUrl },
  ])

  return rawComments.map((comment) => ({
    commentId: String(comment.comment_id || comment.id || ""),
    commentText: String(comment.comment_text || comment.text || comment.content || ""),
    likesCount: Number(comment.likes_count || comment.likes || comment.vote_count || 0),
    repliesCount: Number(comment.replies_count || comment.replies || comment.reply_count || 0),
    username: String(comment.username || comment.author || comment.commenter_name || "Unknown"),
    userChannelUrl: String(comment.user_channel_url || comment.author_url || comment.channel_url || ""),
    datePosted: comment.date_posted ? String(comment.date_posted) : comment.date ? String(comment.date) : null,
  }))
}
