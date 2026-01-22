import { Check, Circle, Clock, ChevronRight } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

type Phase = 'connect' | 'plan' | 'build' | 'validate' | 'deploy'
type ChapterStatus = 'completed' | 'current' | 'pending'

interface Chapter {
  id: string
  name: string
  status: ChapterStatus
}

interface SidebarProps {
  currentPhase: Phase
  chapters: Chapter[]
  onChapterClick?: (chapterId: string) => void
}

const phases: { id: Phase; label: string }[] = [
  { id: 'connect', label: 'Connect' },
  { id: 'plan', label: 'Plan' },
  { id: 'build', label: 'Build' },
  { id: 'validate', label: 'Validate' },
  { id: 'deploy', label: 'Deploy' },
]

export function Sidebar({ currentPhase, chapters, onChapterClick }: SidebarProps) {
  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase)
  const completedChapters = chapters.filter(c => c.status === 'completed').length
  const completionPercentage = chapters.length > 0
    ? Math.round((completedChapters / chapters.length) * 100)
    : 0

  const getPhaseStatus = (index: number) => {
    if (index < currentPhaseIndex) return 'completed'
    if (index === currentPhaseIndex) return 'current'
    return 'pending'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4" />
      case 'current':
        return <Circle className="w-4 h-4 fill-current" />
      default:
        return <Circle className="w-4 h-4" />
    }
  }

  return (
    <aside className="w-72 bg-secondary text-white flex flex-col h-full">
      {/* Phases Section */}
      <div className="p-4">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Phases</h2>
        <nav className="space-y-1">
          {phases.map((phase, index) => {
            const status = getPhaseStatus(index)
            return (
              <div
                key={phase.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  status === 'current'
                    ? 'bg-primary text-white'
                    : status === 'completed'
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-500'
                }`}
              >
                <span className={status === 'completed' ? 'text-success' : ''}>
                  {getStatusIcon(status)}
                </span>
                <span className={status === 'pending' ? 'opacity-50' : ''}>
                  {phase.label}
                </span>
                {status === 'current' && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <Separator className="bg-white/10" />

      {/* Chapters Section (only visible in Build phase) */}
      {currentPhase === 'build' && chapters.length > 0 && (
        <div className="p-4 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-gray-400">Chapters</h2>
            <span className="text-xs text-gray-400">{completionPercentage}%</span>
          </div>
          <nav className="space-y-1">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => onChapterClick?.(chapter.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  chapter.status === 'current'
                    ? 'bg-accent text-white'
                    : chapter.status === 'completed'
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-500'
                }`}
              >
                <span className={chapter.status === 'completed' ? 'text-success' : ''}>
                  {getStatusIcon(chapter.status)}
                </span>
                <span className={`truncate ${chapter.status === 'pending' ? 'opacity-50' : ''}`}>
                  {chapter.name}
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* History Section */}
      <div className="mt-auto p-4 border-t border-white/10">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 text-gray-300">
          <Clock className="w-4 h-4" />
          <span>Version History</span>
        </button>
      </div>
    </aside>
  )
}
