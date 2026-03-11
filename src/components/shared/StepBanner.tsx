"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface StepBannerProps {
  currentStep: number
  totalSteps: number
  prevPage?: { label: string; href: string }
  nextPage?: { label: string; href: string }
  nextReady?: boolean // whether the current step is complete enough to proceed
}

const stepLabels = ["Settings", "Companies", "Engagers", "Enrichment", "Drafts", "Export"]

export function StepBanner({
  currentStep,
  totalSteps,
  prevPage,
  nextPage,
  nextReady = true,
}: StepBannerProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex items-center justify-between z-10">
      <div>
        {prevPage ? (
          <Link
            href={prevPage.href}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            {prevPage.label}
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`w-2 h-2 rounded-full ${
              i + 1 < currentStep
                ? "bg-green-500"
                : i + 1 === currentStep
                  ? "bg-blue-500"
                  : "bg-gray-300"
            }`}
            title={label}
          />
        ))}
        <span className="text-xs text-gray-400 ml-2">
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      <div>
        {nextPage ? (
          nextReady ? (
            <Link
              href={nextPage.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Next: {nextPage.label}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
              Next: {nextPage.label}
              <ChevronRight className="h-4 w-4" />
            </span>
          )
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
