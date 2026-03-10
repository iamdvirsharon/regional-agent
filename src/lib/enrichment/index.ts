// Enrichment provider factory

import type { EnrichmentClient, EnrichmentProvider } from "./types"
import { ApolloClient } from "./apollo"
import { ZoomInfoClient } from "./zoominfo"
import { LeadIQClient } from "./leadiq"

export function getEnrichmentClient(provider: EnrichmentProvider): EnrichmentClient {
  switch (provider) {
    case "apollo":
      return new ApolloClient()
    case "zoominfo":
      return new ZoomInfoClient()
    case "leadiq":
      return new LeadIQClient()
    default:
      throw new Error(`Unknown enrichment provider: ${provider}`)
  }
}

export type { EnrichmentProvider, EnrichmentClient, EnrichmentInput, EnrichmentResult } from "./types"
