/**
 * Step 9: Build
 * Build model through stages A-F with Gemini validation
 */
import { useState } from 'react'
import { useAppStore, useModelBuilderStore } from '@/store'
import { useBuildStage, useGeminiReview } from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import {
  Play,
  Check,
  AlertCircle,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { BUILD_STAGES } from '@/types'
import type { BuildStage } from '@/types/model-builder.types'

export function BuildStep() {
  const { nextStep, prevStep } = useAppStore()
  const {
    sessionId,
    enrichedSpec,
    currentBuildStage,
    stageScripts,
    setStageScript,
    approveStage,
    addGeminiReview,
    enableGeminiValidation,
    shouldValidateWithGemini,
  } = useModelBuilderStore()

  const [expandedStage, setExpandedStage] = useState<BuildStage | null>(currentBuildStage)

  // Build stage mutation
  const buildStage = useBuildStage()

  // Gemini review mutation
  const geminiReview = useGeminiReview()

  const handleBuildStage = async (stage: BuildStage) => {
    if (!sessionId || !enrichedSpec) return

    // Build the stage
    const result = await buildStage.mutateAsync({
      sessionId,
      stage,
      spec: enrichedSpec,
    })
    setStageScript(stage, result)
    setExpandedStage(stage)

    // Optionally validate with Gemini
    if (enableGeminiValidation && shouldValidateWithGemini(result.script)) {
      const review = await geminiReview.mutateAsync({
        script: result.script,
        spec: enrichedSpec,
      })
      addGeminiReview({ ...review, stage })
    }
  }

  const handleApproveStage = (stage: BuildStage) => {
    approveStage(stage)
    // Auto-expand next stage
    const stages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F']
    const nextIndex = stages.indexOf(stage) + 1
    if (nextIndex < stages.length) {
      setExpandedStage(stages[nextIndex])
    }
  }

  const handleRebuildStage = async (stage: BuildStage) => {
    await handleBuildStage(stage)
  }

  const allStagesComplete = BUILD_STAGES.every(
    (stage) => stageScripts[stage.id]?.approved
  )

  const getStageStatus = (stageId: BuildStage) => {
    const script = stageScripts[stageId]
    if (!script) return 'pending'
    if (script.approved) return 'complete'
    return 'ready'
  }

  const isLoading = buildStage.isPending || geminiReview.isPending

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 9: Build Model</h1>
        <p className="text-muted-foreground">
          Build your Qlik data model through 6 stages. Each stage generates script code.
        </p>
      </div>

      {/* Progress Overview */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Build Progress</h2>
          <span className="text-sm text-muted-foreground">
            {Object.values(stageScripts).filter((s) => s?.approved).length} of 6 stages complete
          </span>
        </div>
        <div className="flex gap-1">
          {BUILD_STAGES.map((stage) => {
            const status = getStageStatus(stage.id)
            return (
              <div
                key={stage.id}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  status === 'complete'
                    ? 'bg-green-500'
                    : status === 'ready'
                    ? 'bg-yellow-500'
                    : 'bg-muted'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3 mb-6">
        {BUILD_STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id)
          const script = stageScripts[stage.id]
          const isExpanded = expandedStage === stage.id
          const isCurrent = currentBuildStage === stage.id
          const canBuild =
            index === 0 ||
            stageScripts[BUILD_STAGES[index - 1].id]?.approved

          return (
            <div
              key={stage.id}
              className={`bg-card border rounded-lg overflow-hidden ${
                isCurrent ? 'ring-2 ring-primary/50' : ''
              }`}
            >
              {/* Stage Header */}
              <button
                type="button"
                onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      status === 'complete'
                        ? 'bg-green-500 text-white'
                        : status === 'ready'
                        ? 'bg-yellow-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {status === 'complete' ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      stage.id
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {status === 'complete' && (
                    <StatusBadge status="success" label="Approved" />
                  )}
                  {status === 'ready' && (
                    <StatusBadge status="warning" label="Review" />
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Stage Content */}
              {isExpanded && (
                <div className="border-t p-4">
                  {!script ? (
                    // Build button
                    <div className="flex flex-col items-center py-6">
                      <p className="text-muted-foreground mb-4">
                        {canBuild
                          ? 'Ready to build this stage'
                          : 'Complete previous stages first'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleBuildStage(stage.id)}
                        disabled={!canBuild || isLoading}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                      >
                        {buildStage.isPending &&
                        buildStage.variables?.stage === stage.id ? (
                          <>
                            <LoadingSpinner size="sm" color="white" />
                            Building...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Build Stage {stage.id}
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    // Script preview and actions
                    <div className="space-y-4">
                      {/* Script Preview */}
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              Generated Script
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {script.script.split('\n').length} lines
                          </span>
                        </div>
                        <pre className="text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto bg-background rounded p-3 border">
                          {script.script}
                        </pre>
                      </div>

                      {/* Validation Status */}
                      {script.validation && (
                        <div
                          className={`p-3 rounded-lg ${
                            script.validation.isValid
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-red-50 border border-red-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {script.validation.isValid ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span
                              className={`text-sm font-medium ${
                                script.validation.isValid
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {script.validation.isValid
                                ? 'Validation passed'
                                : 'Validation failed'}
                            </span>
                          </div>
                          {script.validation.errors.length > 0 && (
                            <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                              {script.validation.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          )}
                          {script.validation.warnings.length > 0 && (
                            <ul className="mt-2 text-sm text-yellow-600 list-disc list-inside">
                              {script.validation.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {!script.approved && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleApproveStage(stage.id)}
                            disabled={
                              script.validation && !script.validation.isValid
                            }
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Approve Stage
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRebuildStage(stage.id)}
                            disabled={isLoading}
                            className="px-4 py-2 border rounded-md hover:bg-muted flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Rebuild
                          </button>
                          {enableGeminiValidation && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!enrichedSpec) return
                                const review = await geminiReview.mutateAsync({
                                  script: script.script,
                                  spec: enrichedSpec,
                                })
                                addGeminiReview({ ...review, stage: stage.id })
                              }}
                              disabled={geminiReview.isPending}
                              className="px-4 py-2 border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 flex items-center gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              AI Review
                            </button>
                          )}
                        </div>
                      )}

                      {/* Approved badge */}
                      {script.approved && (
                        <div className="flex items-center gap-2 text-green-600">
                          <Check className="w-5 h-5" />
                          <span className="font-medium">
                            Stage approved
                            {script.approvedAt &&
                              ` on ${new Date(script.approvedAt).toLocaleString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={isLoading}
          className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={!allStagesComplete}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}

export default BuildStep
