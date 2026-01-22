/**
 * Step 1: Connect
 * Connect to Qlik Cloud tenant and select space
 */
import { useState } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import { useTestConnection, useSpaces } from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import { Check, AlertCircle, Cloud, FolderOpen } from 'lucide-react'

export function ConnectStep() {
  const { projectName, setProjectName, nextStep } = useAppStore()
  const { space, setSpace } = useWizardStore()
  const [localProjectName, setLocalProjectName] = useState(projectName)

  // Qlik connection test
  const { data: connectionData, isLoading: isTestingConnection, error: connectionError } =
    useTestConnection()

  // Spaces list
  const { data: spaces, isLoading: isLoadingSpaces } = useSpaces()

  const isConnected = connectionData?.success
  const canProceed = isConnected && space && localProjectName.trim().length > 0

  const handleNext = () => {
    if (canProceed) {
      setProjectName(localProjectName.trim())
      nextStep()
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 1: Connect to Qlik Cloud</h1>
        <p className="text-muted-foreground">
          Connect to your Qlik Cloud tenant and select a space for your project.
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-medium">Qlik Cloud Connection</h2>
          </div>
          {isTestingConnection ? (
            <StatusBadge status="running" label="Testing..." />
          ) : isConnected ? (
            <StatusBadge status="success" label="Connected" />
          ) : connectionError ? (
            <StatusBadge status="error" label="Failed" />
          ) : (
            <StatusBadge status="pending" label="Not connected" />
          )}
        </div>

        {isTestingConnection && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner size="sm" />
            <span>Testing connection to Qlik Cloud...</span>
          </div>
        )}

        {connectionData?.tenantInfo && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Tenant:</span>
              <span className="ml-2 font-medium">{connectionData.tenantInfo.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Region:</span>
              <span className="ml-2 font-medium">{connectionData.tenantInfo.region}</span>
            </div>
          </div>
        )}

        {connectionError && (
          <div className="flex items-start gap-2 text-sm text-red-600 mt-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p>Failed to connect to Qlik Cloud.</p>
              <p className="text-muted-foreground">
                Please check your API key configuration.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Project Name */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <label className="block mb-2">
          <span className="font-medium">Project Name</span>
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={localProjectName}
          onChange={(e) => setLocalProjectName(e.target.value)}
          placeholder="Enter project name (e.g., Sales Analytics)"
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="project-name"
        />
        <p className="text-sm text-muted-foreground mt-2">
          This name will be used for your Qlik app and data files.
        </p>
      </div>

      {/* Space Selection */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-medium">Select Space</h2>
          <span className="text-red-500">*</span>
        </div>

        {isLoadingSpaces ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <LoadingSpinner size="md" />
            <span className="text-muted-foreground">Loading spaces...</span>
          </div>
        ) : !isConnected ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Connect to Qlik Cloud first to see available spaces.
          </p>
        ) : spaces && spaces.length > 0 ? (
          <div className="grid gap-2">
            {spaces.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpace({ id: s.id, name: s.name, type: s.type })}
                data-testid={`space-${s.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center justify-between p-4 border rounded-lg text-left transition-colors ${
                  space?.id === s.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{s.type} space</p>
                </div>
                {space?.id === s.id && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No spaces available. Please create a space in Qlik Cloud first.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Source Selection
        </button>
      </div>
    </div>
  )
}

export default ConnectStep
