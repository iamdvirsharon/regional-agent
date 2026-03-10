// LeadIQ enrichment adapter (GraphQL API)

import type { EnrichmentClient, EnrichmentInput, EnrichmentResult } from "./types"

const SEARCH_PEOPLE_QUERY = `
query SearchPeople($input: SearchPeopleInput!) {
  searchPeople(input: $input) {
    totalResults
    results {
      name { first last }
      currentPositions {
        title
        emails { value status type }
        phones { value type }
        companyInfo { name }
      }
      linkedin { linkedinUrl }
      location { city country }
    }
  }
}
`

export class LeadIQClient implements EnrichmentClient {
  private apiKey: string

  constructor() {
    const key = process.env.LEADIQ_API_KEY
    if (!key) throw new Error("LEADIQ_API_KEY not set")
    this.apiKey = key
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult | null> {
    try {
      // HTTP Basic auth: API key as username, no password
      const authHeader = "Basic " + Buffer.from(this.apiKey + ":").toString("base64")

      const variables: Record<string, unknown> = {
        input: {
          firstName: input.firstName,
          lastName: input.lastName,
          limit: 1,
          ...(input.company ? { company: { name: input.company } } : {}),
          ...(input.linkedinUrl ? { linkedinUrl: input.linkedinUrl } : {}),
        },
      }

      const res = await fetch("https://api.leadiq.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          query: SEARCH_PEOPLE_QUERY,
          variables,
        }),
      })

      if (!res.ok) {
        console.error(`LeadIQ API error: ${res.status} - ${await res.text()}`)
        return null
      }

      const data = await res.json()

      if (data.errors?.length) {
        console.error("LeadIQ GraphQL errors:", data.errors)
        return null
      }

      const person = data.data?.searchPeople?.results?.[0]
      if (!person) return null

      const position = person.currentPositions?.[0]
      const workEmail = position?.emails?.find(
        (e: { type: string; status: string }) => e.type === "work" && e.status === "verified"
      ) || position?.emails?.[0]

      return {
        email: workEmail?.value || null,
        linkedinUrl: person.linkedin?.linkedinUrl || null,
        title: position?.title || null,
        company: position?.companyInfo?.name || null,
        city: person.location?.city || null,
        country: person.location?.country || null,
        headline: null,
      }
    } catch (error) {
      console.error("LeadIQ enrichment error:", error)
      return null
    }
  }
}
