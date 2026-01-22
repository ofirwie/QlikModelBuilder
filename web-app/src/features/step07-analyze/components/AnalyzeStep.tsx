/**
 * Step 7: Analyze
 * Analyze extracted QVD files and classify tables
 */
import { useEffect, useState } from 'react'
import { useAppStore, useWizardStore, useModelBuilderStore } from '@/store'
import { useCreateSession, useAnalyzeQvds } from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import { BarChart3, Table2, Check, AlertCircle, Settings2 } from 'lucide-react'
import type { TableClassification, TableAnalysis } from '@/types/model-builder.types'

const classificationColors: Record<TableClassification, { bg: string; text: string }> = {
  fact: { bg: 'bg-blue-100', text: 'text-blue-800' },
  dimension: { bg: 'bg-green-100', text: 'text-green-800' },
  bridge: { bg: 'bg-purple-100', text: 'text-purple-800' },
  lookup: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  calendar: { bg: 'bg-orange-100', text: 'text-orange-800' },
}

const classificationOptions: { value: TableClassification; label: string }[] = [
  { value: 'fact', label: 'Fact' },
  { value: 'dimension', label: 'Dimension' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'calendar', label: 'Calendar' },
]

export function AnalyzeStep() {
  const { projectName, nextStep, prevStep } = useAppStore()
  const { space, extractResult } = useWizardStore()
  const {
    sessionId,
    setSessionId,
    analysisResult,
    setAnalysisResult,
  } = useModelBuilderStore()

  const [tableOverrides, setTableOverrides] = useState<Record<string, TableClassification>>({})

  // Create session mutation
  const createSession = useCreateSession()

  // Analyze mutation
  const analyzeQvds = useAnalyzeQvds(sessionId)

  // Auto-create session and start analysis when entering this step
  useEffect(() => {
    if (!sessionId && extractResult?.success && space) {
      createSession.mutate({
        projectName,
        qvdPaths: extractResult.qvdPaths,
        spaceId: space.id,
      }, {
        onSuccess: (data) => {
          setSessionId(data.sessionId)
        }
      })
    }
  }, [extractResult, space, projectName, sessionId])

  // Auto-analyze when session is created
  useEffect(() => {
    if (sessionId && !analysisResult && !analyzeQvds.isPending) {
      analyzeQvds.mutate(undefined, {
        onSuccess: (data) => {
          setAnalysisResult(data)
        }
      })
    }
  }, [sessionId, analysisResult])

  const handleClassificationChange = (tableName: string, classification: TableClassification) => {
    setTableOverrides(prev => ({
      ...prev,
      [tableName]: classification
    }))
  }

  const getEffectiveClassification = (table: TableAnalysis): TableClassification => {
    return tableOverrides[table.name] || table.classification
  }

  const isLoading = createSession.isPending || analyzeQvds.isPending
  const hasError = createSession.isError || analyzeQvds.isError
  const isComplete = !!analysisResult

  const factTables = analysisResult?.tables.filter(
    t => getEffectiveClassification(t) === 'fact'
  ) || []
  const dimTables = analysisResult?.tables.filter(
    t => getEffectiveClassification(t) === 'dimension'
  ) || []
  const otherTables = analysisResult?.tables.filter(
    t => !['fact', 'dimension'].includes(getEffectiveClassification(t))
  ) || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 7: Analyze Data</h1>
        <p className="text-muted-foreground">
          Analyze your extracted QVD files and review table classifications.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="font-medium mb-4">Analysis Summary</h2>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Project:</span>
            <span className="ml-2 font-medium">{projectName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">QVD Files:</span>
            <span className="ml-2 font-medium">{extractResult?.qvdPaths.length || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Rows:</span>
            <span className="ml-2 font-medium">
              {extractResult?.rowsExtracted?.toLocaleString() || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Session:</span>
            <span className="ml-2 font-mono text-xs">
              {sessionId ? sessionId.substring(0, 8) + '...' : 'Creating...'}
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Status */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Analysis Status</h2>
          {isLoading && <StatusBadge status="running" label="Analyzing..." />}
          {hasError && <StatusBadge status="error" label="Failed" />}
          {isComplete && <StatusBadge status="success" label="Complete" />}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-muted-foreground">
              {createSession.isPending ? 'Creating session...' : 'Analyzing QVD files...'}
            </span>
          </div>
        )}

        {hasError && (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertCircle className="w-5 h-5" />
            <span>
              {createSession.error?.message || analyzeQvds.error?.message || 'Analysis failed'}
            </span>
          </div>
        )}

        {isComplete && analysisResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              <span>
                Successfully analyzed {analysisResult.tables.length} tables
              </span>
            </div>

            {/* Classification Summary */}
            <div className="grid grid-cols-5 gap-3 pt-4 border-t">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{factTables.length}</p>
                <p className="text-sm text-blue-700">Fact Tables</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{dimTables.length}</p>
                <p className="text-sm text-green-700">Dimensions</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {otherTables.filter(t => getEffectiveClassification(t) === 'bridge').length}
                </p>
                <p className="text-sm text-purple-700">Bridge</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {otherTables.filter(t => getEffectiveClassification(t) === 'lookup').length}
                </p>
                <p className="text-sm text-yellow-700">Lookup</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {otherTables.filter(t => getEffectiveClassification(t) === 'calendar').length}
                </p>
                <p className="text-sm text-orange-700">Calendar</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Classifications */}
      {isComplete && analysisResult && (
        <div className="bg-card border rounded-lg mb-6 overflow-hidden">
          <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-medium">Table Classifications</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings2 className="w-4 h-4" />
              <span>Click to adjust classifications</span>
            </div>
          </div>
          <div className="divide-y">
            {analysisResult.tables.map((table) => {
              const effectiveClass = getEffectiveClassification(table)
              const colors = classificationColors[effectiveClass]
              const isOverridden = tableOverrides[table.name] !== undefined

              return (
                <div
                  key={table.name}
                  className="flex items-center justify-between p-4 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{table.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {table.metrics.rowCount.toLocaleString()} rows •{' '}
                        {table.metrics.columnCount} columns •{' '}
                        {Math.round(table.classificationConfidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isOverridden && (
                      <span className="text-xs text-muted-foreground">(modified)</span>
                    )}
                    <select
                      value={effectiveClass}
                      onChange={(e) => handleClassificationChange(table.name, e.target.value as TableClassification)}
                      aria-label={`Classification for ${table.name}`}
                      className={`px-3 py-1 rounded-md text-sm font-medium border-0 cursor-pointer ${colors.bg} ${colors.text}`}
                    >
                      {classificationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Recommendation */}
      {isComplete && analysisResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-800">AI Recommendation</p>
              <p className="text-sm text-blue-700 mt-1">
                Based on the analysis, the recommended model type is{' '}
                <strong>{analysisResult.recommendedModelType.replace('_', ' ')}</strong>
                {' '}with {Math.round(analysisResult.confidence * 100)}% confidence.
              </p>
              <p className="text-sm text-blue-600 mt-2">{analysisResult.reasoning}</p>
            </div>
          </div>
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
          disabled={!isComplete}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Model Type
        </button>
      </div>
    </div>
  )
}

export default AnalyzeStep
