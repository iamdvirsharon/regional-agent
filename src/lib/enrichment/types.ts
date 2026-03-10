// Shared enrichment interfaces for all providers

export interface EnrichmentInput {
  firstName: string
  lastName: string
  company?: string
  linkedinUrl?: string
}

export interface EnrichmentResult {
  email: string | null
  linkedinUrl: string | null
  title: string | null
  company: string | null
  city: string | null
  country: string | null
  headline: string | null
}

export type EnrichmentProvider = "apollo" | "zoominfo" | "leadiq"

export interface EnrichmentClient {
  enrich(input: EnrichmentInput): Promise<EnrichmentResult | null>
}
