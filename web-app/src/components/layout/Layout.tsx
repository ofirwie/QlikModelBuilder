import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

type Phase = 'connect' | 'plan' | 'build' | 'validate' | 'deploy'
type ChapterStatus = 'completed' | 'current' | 'pending'

interface Chapter {
  id: string
  name: string
  status: ChapterStatus
}

interface LayoutProps {
  children: ReactNode
  projectName: string
  currentPhase: Phase
  chapters?: Chapter[]
  buildProgress?: {
    currentChapter: number
    totalChapters: number
  }
  onChapterClick?: (chapterId: string) => void
}

export function Layout({
  children,
  projectName,
  currentPhase,
  chapters = [],
  buildProgress,
  onChapterClick,
}: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <Header
        projectName={projectName}
        currentPhase={currentPhase}
        buildProgress={buildProgress}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentPhase={currentPhase}
          chapters={chapters}
          onChapterClick={onChapterClick}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* AI Assistant (collapsed by default) */}
      <div className="h-14 border-t border-border bg-white px-4 flex items-center">
        <div className="flex items-center gap-3 text-muted-foreground">
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
