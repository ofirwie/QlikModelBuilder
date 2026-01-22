/**
 * Step 11: Deploy
 * Deploy completed model to Qlik Cloud
 */
import { useState } from 'react'
import { useAppStore, useWizardStore, useModelBuilderStore } from '@/store'
import { useDeploy } from '@/api'
import { LoadingSpinner } from '@/shared'
import {
  Cloud,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  PartyPopper,
  FileCode,
  Rocket,
} from 'lucide-react'

export function DeployStep() {
  const { projectName, reset: resetApp } = useAppStore()
  const { space, reset: resetWizard } = useWizardStore()
  const {
    sessionId,
    finalScript,
    deployResult,
    setDeployResult,
    reset: resetModelBuilder,
  } = useModelBuilderStore()

  const [appName, setAppName] = useState(`${projectName}_Model`)
  const [isDeploying, setIsDeploying] = useState(false)

  // Deploy mutation
  const deploy = useDeploy()

  const handleDeploy = async () => {
    if (!sessionId || !finalScript || !space) return

    setIsDeploying(true)
    try {
      const result = await deploy.mutateAsync({
        sessionId,
        appName,
        spaceId: space.id,
        script: finalScript,
      })
      setDeployResult(result)
    } catch (error) {
      setDeployResult({
        success: false,
        appId: null,
        error: error instanceof Error ? error.message : 'Deployment failed',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsDeploying(false)
    }
  }

  const handleStartNewProject = () => {
    // Reset all stores
    resetApp()
    resetWizard()
    resetModelBuilder()
  }

  const isLoading = isDeploying || deploy.isPending

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 11: Deploy to Qlik Cloud</h1>
        <p className="text-muted-foreground">
          Deploy your completed data model as a Qlik Sense application.
        </p>
      </div>

      {/* Deployment Result */}
      {deployResult ? (
        <div className="space-y-6">
          {deployResult.success ? (
            // Success State
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <PartyPopper className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-700 mb-2">
                Deployment Successful!
              </h2>
              <p className="text-green-600 mb-6">
                Your data model has been deployed to Qlik Cloud.
              </p>

              {/* App Details */}
              <div className="bg-white/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">App Name:</span>
                    <span className="font-medium">{appName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Space:</span>
                    <span className="font-medium">{space?.name}</span>
                  </div>
                  {deployResult.appId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">App ID:</span>
                      <span className="font-mono text-xs">{deployResult.appId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deployed:</span>
                    <span className="font-medium">
                      {new Date(deployResult.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {deployResult.appUrl && (
                  <a
                    href={deployResult.appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Qlik Cloud
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleStartNewProject}
                  className="px-6 py-2 border border-green-300 text-green-700 rounded-md hover:bg-green-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Start New Project
                </button>
              </div>
            </div>
          ) : (
            // Error State
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 mb-2">
                Deployment Failed
              </h2>
              <p className="text-red-600 mb-4">{deployResult.error}</p>

              {/* Retry Button */}
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}
        </div>
      ) : (
        // Pre-deployment State
        <div className="space-y-6">
          {/* Deployment Summary */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="font-medium mb-4">Deployment Summary</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Target Space</p>
                    <p className="font-medium">{space?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Script Lines</p>
                    <p className="font-medium">{finalScript?.split('\n').length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter app name..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="font-medium mb-4">Pre-deployment Checklist</h2>
            <div className="space-y-2">
              {[
                { label: 'QVD files extracted', done: true },
                { label: 'Model type selected', done: true },
                { label: 'All build stages completed', done: true },
                { label: 'Script reviewed and approved', done: true },
                { label: 'Target space selected', done: !!space },
                { label: 'App name specified', done: appName.trim().length > 0 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      item.done ? 'bg-green-500 text-white' : 'bg-muted'
                    }`}
                  >
                    {item.done && <Check className="w-3 h-3" />}
                  </div>
                  <span className={item.done ? '' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deploy Button */}
          <div className="flex flex-col items-center py-6">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={!appName.trim() || !finalScript || !space || isLoading}
              className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Deploy to Qlik Cloud
                </>
              )}
            </button>
            <p className="text-sm text-muted-foreground mt-3">
              This will create a new Qlik Sense application in your selected space.
            </p>
          </div>
        </div>
      )}

      {/* Navigation (only show back button if not deployed successfully) */}
      {!deployResult?.success && (
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            disabled={isLoading}
            className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Back
          </button>
          <div />
        </div>
      )}
    </div>
  )
}

export default DeployStep
