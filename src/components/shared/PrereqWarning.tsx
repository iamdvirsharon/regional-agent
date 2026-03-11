"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface PrereqWarningProps {
  message: string
  linkLabel: string
  href: string
}

export function PrereqWarning({ message, linkLabel, href }: PrereqWarningProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 flex-1">{message}</p>
      <Link
        href={href}
        className="text-xs font-medium text-amber-700 hover:text-amber-900 underline flex-shrink-0"
      >
        {linkLabel}
      </Link>
    </div>
  )
}
