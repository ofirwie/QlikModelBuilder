import { Progress } from '@/components/ui/progress'
import { Settings, HelpCircle, User } from 'lucide-react'
import { STEPS } from '@/types'

interface HeaderProps {
  projectName: string
  currentStep: number
}

export function Header({ projectName, currentStep }: HeaderProps) {
  const step = STEPS.find(s => s.id === currentStep)
  const stage = step?.stage === 1 ? 'Data Extraction' : 'Model Building'
  const overallProgress = ((currentStep - 1) / 10) * 100

  return (
    <header className="h-16 bg-white border-b border-border px-4 flex items-center justify-between">
      {/* Left: Logo and Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦊</span>
          <span className="font-bold text-xl">QlikFox</span>
        </div>
        <div className="border-l pl-4">
          <span className="text-sm text-muted-foreground">Project:</span>
          <span className="ml-2 font-medium">{projectName}</span>
        </div>
      </div>

      {/* Center: Progress Indicator */}
      <div className="flex-1 max-w-lg mx-8">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-xs text-muted-foreground">{stage}</span>
            <p className="text-sm font-medium">
              Step {currentStep}: {step?.name}
            </p>
          </div>
          <span className="text-sm font-medium">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Stage 1</span>
          <span>Stage 2</span>
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
