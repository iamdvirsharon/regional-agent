// Apollo.io enrichment adapter

import type { EnrichmentClient, EnrichmentInput, EnrichmentResult } from "./types"

export class ApolloClient implements EnrichmentClient {
  private apiKey: string

  constructor() {
    const key = process.env.APOLLO_API_KEY
    if (!key) throw new Error("APOLLO_API_KEY not set")
    this.apiKey = key
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult | null> {
    try {
      const res = await fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          first_name: input.firstName,
          last_name: input.lastName,
          organization_name: input.company,
          linkedin_url: input.linkedinUrl,
        }),
      })

      if (!res.ok) {
        console.error(`Apollo API error: ${res.status} - ${await res.text()}`)
        return null
      }

      const data = await res.json()
      const p = data.person
      if (!p) return null

      return {
        email: p.email || null,
        linkedinUrl: p.linkedin_url || null,
        title: p.title || null,
        company: p.organization_name || p.organization?.name || null,
        city: p.city || null,
        country: p.country || null,
        headline: p.headline || null,
      }
    } catch (error) {
      console.error("Apollo enrichment error:", error)
      return null
    }
  }
}
