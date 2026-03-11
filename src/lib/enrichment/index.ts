// Enrichment provider factory

import type { EnrichmentClient, EnrichmentProvider } from "./types"
import { ApolloClient } from "./apollo"
import { ZoomInfoClient } from "./zoominfo"
import { LeadIQClient } from "./leadiq"

export async function getEnrichmentClient(provider: EnrichmentProvider): Promise<EnrichmentClient> {
  switch (provider) {
    case "apollo":
      return ApolloClient.create()
    case "zoominfo":
      return ZoomInfoClient.create()
    case "leadiq":
      return LeadIQClient.create()
    default:
      throw new Error(`Unknown enrichment provider: ${provider}`)
  }
}

export type { EnrichmentProvider, EnrichmentClient, EnrichmentInput, EnrichmentResult } from "./types"
