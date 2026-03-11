export function getBaseUrl(): string {
  // Explicit override takes priority
  if (process.env.APP_URL) return process.env.APP_URL

  // Vercel auto-sets this — always available in serverless functions
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  // Vercel also sets this for preview/production deployments
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`

  return "http://localhost:3000"
}
