"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface EmptyStateProps {
  icon: React.ElementType
  heading: string
  description: string
  primaryCTA?: { label: string; href: string }
  secondaryText?: string
  secondaryHref?: string
}

export function EmptyState({
  icon: Icon,
  heading,
  description,
  primaryCTA,
  secondaryText,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl border p-12 text-center">
      <Icon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="font-semibold text-gray-900">{heading}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{description}</p>
      {primaryCTA && (
        <Link
          href={primaryCTA.href}
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {primaryCTA.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
      {secondaryText && secondaryHref && (
        <p className="mt-3">
          <Link href={secondaryHref} className="text-xs text-blue-600 hover:underline">
            {secondaryText}
          </Link>
        </p>
      )}
    </div>
  )
}
