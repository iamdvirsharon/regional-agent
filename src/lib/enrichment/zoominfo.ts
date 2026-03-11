// ZoomInfo enrichment adapter

import type { EnrichmentClient, EnrichmentInput, EnrichmentResult } from "./types"
import { getConfigValue } from "@/lib/config"

export class ZoomInfoClient implements EnrichmentClient {
  private clientId: string
  private privateKey: string
  private accessToken: string | null = null

  constructor(clientId: string, privateKey: string) {
    this.clientId = clientId
    this.privateKey = privateKey
  }

  static async create(): Promise<ZoomInfoClient> {
    const clientId = await getConfigValue("ZOOMINFO_CLIENT_ID")
    const privateKey = await getConfigValue("ZOOMINFO_PRIVATE_KEY")
    if (!clientId || !privateKey) throw new Error("ZOOMINFO_CLIENT_ID and ZOOMINFO_PRIVATE_KEY must be set")
    return new ZoomInfoClient(clientId, privateKey)
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken

    const res = await fetch("https://api.zoominfo.com/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        privateKey: this.privateKey,
      }),
    })

    if (!res.ok) {
      throw new Error(`ZoomInfo auth failed: ${res.status} - ${await res.text()}`)
    }

    const data = await res.json()
    this.accessToken = data.jwt
    return data.jwt
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult | null> {
    try {
      const token = await this.authenticate()

      const res = await fetch("https://api.zoominfo.com/enrich/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          matchPersonInput: [
            {
              firstName: input.firstName,
              lastName: input.lastName,
              companyName: input.company,
              linkedInUrl: input.linkedinUrl,
            },
          ],
          outputFields: [
            "firstName", "lastName", "email", "jobTitle",
            "companyName", "city", "country", "linkedInUrl",
          ],
        }),
      })

      if (!res.ok) {
        // Token might have expired — clear and retry once
        if (res.status === 401 && this.accessToken) {
          this.accessToken = null
          return this.enrich(input)
        }
        console.error(`ZoomInfo API error: ${res.status} - ${await res.text()}`)
        return null
      }

      const data = await res.json()
      const contact = data.data?.[0]
      if (!contact) return null

      return {
        email: contact.email || null,
        linkedinUrl: contact.linkedInUrl || null,
        title: contact.jobTitle || null,
        company: contact.companyName || null,
        city: contact.city || null,
        country: contact.country || null,
        headline: null,
      }
    } catch (error) {
      console.error("ZoomInfo enrichment error:", error)
      return null
    }
  }
}
