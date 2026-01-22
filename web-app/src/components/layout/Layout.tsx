import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
  projectName: string
  currentStep: number
  maxReachedStep: number
  onStepClick?: (step: number) => void
}

export function Layout({
  children,
  projectName,
  currentStep,
  maxReachedStep,
  onStepClick,
}: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <Header projectName={projectName} currentStep={currentStep} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          onStepClick={onStepClick}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* AI Assistant (collapsed by default) */}
      <div className="h-14 border-t border-border bg-white px-4 flex items-center">
        <div className="flex items-center gap-3 text-muted-foreground flex-1">
          <span className="text-lg">💬</span>
          <input
            type="text"
            placeholder="Ask AI assistant..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary/90">
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
