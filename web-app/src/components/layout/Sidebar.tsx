import { Check, Circle, ChevronRight, Clock } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { STEPS } from '@/types'

interface SidebarProps {
  currentStep: number
  maxReachedStep: number
  onStepClick?: (step: number) => void
}

export function Sidebar({ currentStep, maxReachedStep, onStepClick }: SidebarProps) {
  const stage1Steps = STEPS.filter(s => s.stage === 1)
  const stage2Steps = STEPS.filter(s => s.stage === 2)

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed'
    if (stepId === currentStep) return 'current'
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

  const renderStep = (step: typeof STEPS[number]) => {
    const status = getStepStatus(step.id)
    const canNavigate = step.id <= maxReachedStep

    return (
      <button
        key={step.id}
        onClick={() => canNavigate && onStepClick?.(step.id)}
        disabled={!canNavigate}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
          status === 'current'
            ? 'bg-primary text-white'
            : status === 'completed'
            ? 'text-gray-300 hover:bg-white/10 cursor-pointer'
            : 'text-gray-500 cursor-not-allowed'
        }`}
      >
        <span className="text-xs font-mono w-5 text-center">{step.id}</span>
        <span className={status === 'completed' ? 'text-success' : ''}>
          {getStatusIcon(status)}
        </span>
        <span className={`truncate ${status === 'pending' ? 'opacity-50' : ''}`}>
          {step.name}
        </span>
        {status === 'current' && (
          <ChevronRight className="w-4 h-4 ml-auto" />
        )}
      </button>
    )
  }

  return (
    <aside className="w-72 bg-secondary text-white flex flex-col h-full">
      {/* Stage 1: Data Extraction */}
      <div className="p-4">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">
          Stage 1: Data Extraction
        </h2>
        <nav className="space-y-1">
          {stage1Steps.map(renderStep)}
        </nav>
      </div>

      <Separator className="bg-white/10" />

      {/* Stage 2: Model Building */}
      <div className="p-4 flex-1 overflow-auto">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-3">
          Stage 2: Model Building
        </h2>
        <nav className="space-y-1">
          {stage2Steps.map(renderStep)}
        </nav>
      </div>

      {/* Progress indicator */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(((currentStep - 1) / 10) * 100)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${((currentStep - 1) / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* History Section */}
      <div className="p-4 border-t border-white/10">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 text-gray-300">
          <Clock className="w-4 h-4" />
          <span>Version History</span>
        </button>
      </div>
    </aside>
  )
}
