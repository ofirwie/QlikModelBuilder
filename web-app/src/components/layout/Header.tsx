import { Progress } from '@/components/ui/progress'
import { Check, Circle, Settings, HelpCircle, User } from 'lucide-react'

type Phase = 'connect' | 'plan' | 'build' | 'validate' | 'deploy'

interface HeaderProps {
  projectName: string
  currentPhase: Phase
  buildProgress?: {
    currentChapter: number
    totalChapters: number
  }
}

const phases: { id: Phase; label: string }[] = [
  { id: 'connect', label: 'Connect' },
  { id: 'plan', label: 'Plan' },
  { id: 'build', label: 'Build' },
  { id: 'validate', label: 'Validate' },
  { id: 'deploy', label: 'Deploy' },
]

export function Header({ projectName, currentPhase, buildProgress }: HeaderProps) {
  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase)
  const overallProgress = ((currentPhaseIndex + 1) / phases.length) * 100

  const getPhaseStatus = (index: number) => {
    if (index < currentPhaseIndex) return 'completed'
    if (index === currentPhaseIndex) return 'current'
    return 'upcoming'
  }

  return (
    <header className="h-16 bg-white border-b border-border px-4 flex items-center justify-between">
      {/* Left: Logo and Project Name */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <span className="text-white font-bold text-sm">Q</span>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Project:</span>
          <span className="ml-2 font-medium">{projectName}</span>
        </div>
      </div>

      {/* Center: Progress Indicator */}
      <div className="flex-1 max-w-2xl mx-8">
        <div className="flex items-center justify-between mb-1">
          {phases.map((phase, index) => {
            const status = getPhaseStatus(index)
            return (
              <div key={phase.id} className="flex flex-col items-center">
                <div className="flex items-center">
                  {index > 0 && (
                    <div
                      className={`h-0.5 w-12 -mr-1 ${
                        index <= currentPhaseIndex ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      status === 'completed'
                        ? 'bg-primary text-white'
                        : status === 'current'
                        ? 'bg-primary text-white ring-2 ring-accent ring-offset-2'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {status === 'completed' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                  </div>
                  {index < phases.length - 1 && (
                    <div
                      className={`h-0.5 w-12 -ml-1 ${
                        index < currentPhaseIndex ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
                <span className={`text-xs mt-1 ${
                  status === 'current' ? 'font-medium text-primary' : 'text-muted-foreground'
                }`}>
                  {phase.label}
                </span>
                {status === 'current' && buildProgress && phase.id === 'build' && (
                  <span className="text-xs text-accent">
                    Ch {buildProgress.currentChapter}/{buildProgress.totalChapters}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <Progress value={overallProgress} className="h-1.5" />
        <div className="text-center text-xs text-muted-foreground mt-1">
          {Math.round(overallProgress)}% Complete
        </div>
      </div>

      {/* Right: User Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-muted rounded-md">
          <User className="w-5 h-5 text-muted-foreground" />
        </button>
        <button className="p-2 hover:bg-muted rounded-md">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
        <button className="p-2 hover:bg-muted rounded-md">
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
