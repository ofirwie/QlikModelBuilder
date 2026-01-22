/**
 * Step 6: Extract
 * Run extraction to QVD files
 */
import { useState, useEffect } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import {
  useStartExtraction,
  useExtractionProgress,
  useGenerateScript,
  useCancelExtraction,
} from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import { Play, Square, Check, AlertCircle, FileCode } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export function ExtractStep() {
  const { projectName, nextStep, prevStep } = useAppStore()
  const { space, connection, tables, setExtractResult, extractResult } =
    useWizardStore()

  const [jobId, setJobId] = useState<string | null>(null)
  const [showScript, setShowScript] = useState(false)

  // Generate script mutation
  const generateScript = useGenerateScript()

  // Start extraction mutation
  const startExtraction = useStartExtraction()

  // Extraction progress query
  const { data: progress } = useExtractionProgress(
    jobId,
    jobId !== null && !extractResult?.success
  )

  // Cancel extraction mutation
  const cancelExtraction = useCancelExtraction()

  // Handle script generation
  useEffect(() => {
    if (connection && tables.length > 0 && !generateScript.data) {
      generateScript.mutate({
        connection,
        tables,
        qvdPath: `lib://DataFiles/${projectName}/`,
      })
    }
  }, [connection, tables, projectName])

  // Update extract result when complete
  useEffect(() => {
    if (progress?.status === 'completed') {
      setExtractResult({
        success: true,
        qvdPaths: tables.map((t) => `lib://DataFiles/${projectName}/${t.name}.qvd`),
        appId: null,
        rowsExtracted: progress.rowsExtracted,
      })
    } else if (progress?.status === 'failed') {
      setExtractResult({
        success: false,
        qvdPaths: [],
        appId: null,
        error: progress.error,
      })
    }
  }, [progress])

  const handleStartExtraction = async () => {
    if (!space || !connection) return

    const result = await startExtraction.mutateAsync({
      connection,
      tables,
      spaceId: space.id,
      projectName,
    })
    setJobId(result.jobId)
  }

  const handleCancelExtraction = () => {
    if (jobId) {
      cancelExtraction.mutate(jobId)
      setJobId(null)
    }
  }

  const isExtracting = jobId !== null && progress?.status === 'running'
  const isComplete = extractResult?.success
  const hasFailed = extractResult?.success === false

  const progressPercentage =
    progress && progress.totalTables > 0
      ? (progress.tablesCompleted / progress.totalTables) * 100
      : 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 6: Extract Data</h1>
        <p className="text-muted-foreground">
          Run the data extraction to create QVD files in Qlik Cloud.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="font-medium mb-4">Extraction Summary</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Project:</span>
            <span className="ml-2 font-medium">{projectName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Space:</span>
            <span className="ml-2 font-medium">{space?.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tables:</span>
            <span className="ml-2 font-medium">{tables.length}</span>
          </div>
        </div>
      </div>

      {/* Generated Script Preview */}
      <div className="bg-card border rounded-lg mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowScript(!showScript)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Generated Script</span>
          </div>
          {generateScript.isPending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {showScript ? 'Hide' : 'Show'}
            </span>
          )}
        </button>
        {showScript && generateScript.data && (
          <div className="border-t p-4 bg-muted/30">
            <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-auto">
              {generateScript.data.script}
            </pre>
          </div>
        )}
      </div>

      {/* Extraction Status */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Extraction Status</h2>
          {isComplete && <StatusBadge status="success" label="Completed" />}
          {isExtracting && <StatusBadge status="running" label="Extracting..." />}
          {hasFailed && <StatusBadge status="error" label="Failed" />}
          {!isComplete && !isExtracting && !hasFailed && (
            <StatusBadge status="pending" label="Ready" />
          )}
        </div>

        {/* Progress */}
        {isExtracting && progress && (
          <div className="space-y-3">
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Table {progress.tablesCompleted + 1} of {progress.totalTables}
                {progress.currentTable && `: ${progress.currentTable}`}
              </span>
              <span>{progress.rowsExtracted.toLocaleString()} rows extracted</span>
            </div>
          </div>
        )}

        {/* Success */}
        {isComplete && extractResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              <span>
                Successfully extracted {extractResult.rowsExtracted?.toLocaleString()} rows
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">QVD files created:</p>
              <ul className="list-disc list-inside space-y-1">
                {extractResult.qvdPaths.map((path) => (
                  <li key={path} className="font-mono text-xs">
                    {path}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Error */}
        {hasFailed && extractResult && (
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Extraction failed</p>
              <p className="text-sm">{extractResult.error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isComplete && (
          <div className="mt-6 flex gap-3">
            {isExtracting ? (
              <button
                type="button"
                onClick={handleCancelExtraction}
                className="px-4 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-50 flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartExtraction}
                disabled={startExtraction.isPending || !space || !connection}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {startExtraction.isPending ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Extraction
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={isExtracting}
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
          Continue to Model Building
        </button>
      </div>
    </div>
  )
}

export default ExtractStep
