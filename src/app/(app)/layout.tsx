import { Sidebar } from "@/components/layout/Sidebar"
import { StatsProvider } from "@/components/providers/StatsProvider"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StatsProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </StatsProvider>
  )
}
