/**
 * Step 10: Review
 * Final review with Gemini AI validation
 */
import { useState, useEffect } from 'react'
import { useAppStore, useModelBuilderStore } from '@/store'
import { useFinalScript, useGeminiReview } from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import {
  FileCode,
  Sparkles,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
} from 'lucide-react'
import type { GeminiIssue } from '@/types/model-builder.types'

const severityConfig: Record<GeminiIssue['severity'], { icon: React.ReactNode; bg: string; text: string }> = {
  critical: {
    icon: <AlertCircle className="w-4 h-4" />,
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
}

export function ReviewStep() {
  const { projectName, nextStep, prevStep } = useAppStore()
  const {
    sessionId,
    enrichedSpec,
    geminiReviews,
    setFinalScript,
    finalScript,
    addGeminiReview,
    enableGeminiValidation,
  } = useModelBuilderStore()

  const [showScript, setShowScript] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch final combined script
  const { data: scriptData, isLoading: isLoadingScript } = useFinalScript(sessionId)

  // Gemini review mutation
  const geminiReview = useGeminiReview()

  // Set final script when loaded
  useEffect(() => {
    if (scriptData?.script && !finalScript) {
      setFinalScript(scriptData.script)
    }
  }, [scriptData])

  // Auto-trigger Gemini review when script is ready
  useEffect(() => {
    if (
      enableGeminiValidation &&
      finalScript &&
      enrichedSpec &&
      geminiReviews.length === 0 &&
      !geminiReview.isPending
    ) {
      handleReview()
    }
  }, [finalScript, enrichedSpec, enableGeminiValidation])

  const handleReview = async () => {
    if (!finalScript || !enrichedSpec) return

    const review = await geminiReview.mutateAsync({
      script: finalScript,
      spec: enrichedSpec,
    })
    addGeminiReview(review)
  }

  const handleCopyScript = async () => {
    if (!finalScript) return
    await navigator.clipboard.writeText(finalScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadScript = () => {
    if (!finalScript) return
    const blob = new Blob([finalScript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}_model.qvs`
    a.click()
    URL.revokeObjectURL(url)
  }

  const latestReview = geminiReviews[geminiReviews.length - 1]
  const isLoading = isLoadingScript || geminiReview.isPending
  const canProceed = !enableGeminiValidation || latestReview?.approved

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500/10 to-green-500/5'
    if (score >= 60) return 'from-yellow-500/10 to-yellow-500/5'
    return 'from-red-500/10 to-red-500/5'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 10: Final Review</h1>
        <p className="text-muted-foreground">
          Review the complete generated script and get AI validation before deployment.
        </p>
      </div>

      {/* Script Summary */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Generated Script</h2>
          {isLoadingScript && <StatusBadge status="running" label="Loading..." />}
          {finalScript && <StatusBadge status="success" label="Ready" />}
        </div>

        {isLoadingScript ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-muted-foreground">Loading final script...</span>
          </div>
        ) : finalScript ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{finalScript.split('\n').length} lines of Qlik script</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1 border rounded-md hover:bg-muted flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  className="px-3 py-1 border rounded-md hover:bg-muted flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>

            {/* Collapsible Script Preview */}
            <button
              type="button"
              onClick={() => setShowScript(!showScript)}
              className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {showScript ? 'Hide Script' : 'View Script'}
                </span>
              </div>
              {showScript ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showScript && (
              <pre className="text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto bg-muted/50 rounded-lg p-4 border">
                {finalScript}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            No script available
          </p>
        )}
      </div>

      {/* Gemini Review */}
      {enableGeminiValidation && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="font-medium">AI Review</h2>
            </div>
            {geminiReview.isPending && <StatusBadge status="running" label="Reviewing..." />}
            {latestReview?.approved && <StatusBadge status="success" label="Approved" />}
            {latestReview && !latestReview.approved && (
              <StatusBadge status="warning" label="Needs Attention" />
            )}
          </div>

          {geminiReview.isPending ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-muted-foreground">
                AI is reviewing your script...
              </span>
            </div>
          ) : latestReview ? (
            <div className="space-y-6">
              {/* Score */}
              <div className={`bg-gradient-to-r ${getScoreBg(latestReview.score)} rounded-lg p-6`}>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className={`text-5xl font-bold ${getScoreColor(latestReview.score)}`}>
                      {latestReview.score}
                    </p>
                    <p className="text-sm text-muted-foreground">out of 100</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">
                      {latestReview.approved ? (
                        <span className="text-green-600 flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Approved for Deployment
                        </span>
                      ) : (
                        <span className="text-yellow-600 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Needs Attention
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{latestReview.summary}</p>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              {latestReview.strengths.length > 0 && (
                <div>
                  <h3 className="font-medium text-green-700 mb-2">Strengths</h3>
                  <ul className="space-y-1">
                    {latestReview.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Issues */}
              {latestReview.issues.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Issues Found</h3>
                  <div className="space-y-2">
                    {latestReview.issues.map((issue, i) => {
                      const config = severityConfig[issue.severity]
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border ${config.bg}`}
                        >
                          <div className={`flex items-center gap-2 ${config.text} font-medium`}>
                            {config.icon}
                            <span className="capitalize">{issue.severity}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{issue.category}</span>
                          </div>
                          <p className="text-sm mt-1">{issue.description}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Suggestion:</strong> {issue.suggestion}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Re-review button */}
              <button
                type="button"
                onClick={handleReview}
                disabled={geminiReview.isPending}
                className="px-4 py-2 border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Run Review Again
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Submit your script for AI review to check for issues and best practices.
              </p>
              <button
                type="button"
                onClick={handleReview}
                disabled={!finalScript || geminiReview.isPending}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                Submit for Review
              </button>
            </div>
          )}
        </div>
      )}

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
          disabled={!canProceed || !finalScript}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Deploy
        </button>
      </div>
    </div>
  )
}

export default ReviewStep
