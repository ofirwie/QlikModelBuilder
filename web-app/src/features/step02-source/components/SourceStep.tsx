/**
 * Step 2: Source
 * Select data source type and configure connection
 */
import { useState } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import { useTestDbConnection, useConnections } from '@/api'
import { LoadingSpinner, StatusBadge } from '@/shared'
import { Database, Globe, FileText, Check, AlertCircle, ChevronRight } from 'lucide-react'
import type { ConnectionType } from '@/types/wizard.types'

interface SourceOption {
  type: ConnectionType
  name: string
  description: string
  icon: React.ReactNode
  available: boolean
}

const sourceOptions: SourceOption[] = [
  {
    type: 'odbc',
    name: 'Database (ODBC)',
    description: 'Connect to SQL Server, PostgreSQL, MySQL, Oracle, and more',
    icon: <Database className="w-6 h-6" />,
    available: true,
  },
  {
    type: 'rest_api',
    name: 'REST API',
    description: 'Connect to external APIs and web services',
    icon: <Globe className="w-6 h-6" />,
    available: false, // Coming soon
  },
  {
    type: 'file',
    name: 'File Upload',
    description: 'Upload CSV, Excel, or QVD files directly',
    icon: <FileText className="w-6 h-6" />,
    available: false, // Coming soon
  },
  {
    type: 'qvd',
    name: 'Existing QVD',
    description: 'Use existing QVD files from Qlik Cloud storage',
    icon: <Database className="w-6 h-6" />,
    available: true,
  },
]

export function SourceStep() {
  const { nextStep, prevStep } = useAppStore()
  const { connection, setConnection } = useWizardStore()

  const [selectedType, setSelectedType] = useState<ConnectionType | null>(
    connection?.type || null
  )
  const [connectionString, setConnectionString] = useState(connection?.connectionString || '')
  const [connectionName, setConnectionName] = useState(connection?.name || '')

  // Existing Qlik connections
  const { data: qlikConnections, isLoading: isLoadingConnections } = useConnections()

  // Test connection mutation
  const testConnection = useTestDbConnection()

  const handleTestConnection = async () => {
    if (!selectedType || !connectionString) return

    testConnection.mutate({
      id: crypto.randomUUID(),
      name: connectionName || 'New Connection',
      type: selectedType,
      connectionString,
      validated: false,
    })
  }

  const handleSelectExistingConnection = (conn: { id: string; name: string; type: string }) => {
    setConnection({
      id: conn.id,
      name: conn.name,
      type: conn.type as ConnectionType,
      connectionString: '',
      validated: true,
    })
    setSelectedType(conn.type as ConnectionType)
    setConnectionName(conn.name)
  }

  const handleNext = () => {
    if (connection?.validated || testConnection.data?.success) {
      if (!connection?.validated) {
        setConnection({
          id: crypto.randomUUID(),
          name: connectionName || 'New Connection',
          type: selectedType!,
          connectionString,
          validated: true,
        })
      }
      nextStep()
    }
  }

  const canProceed = connection?.validated || testConnection.data?.success

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 2: Select Data Source</h1>
        <p className="text-muted-foreground">
          Choose your data source type and configure the connection.
        </p>
      </div>

      {/* Source Type Selection */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="font-medium mb-4">Source Type</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {sourceOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={!option.available}
              onClick={() => {
                setSelectedType(option.type)
                setConnection(null)
              }}
              data-testid={`source-${option.type}`}
              className={`flex items-start gap-4 p-4 border rounded-lg text-left transition-colors ${
                selectedType === option.type
                  ? 'border-primary bg-primary/5'
                  : option.available
                  ? 'hover:border-muted-foreground/50'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                selectedType === option.type ? 'bg-primary/10 text-primary' : 'bg-muted'
              }`}>
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{option.name}</p>
                  {!option.available && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">Coming Soon</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {selectedType === option.type && (
                <Check className="w-5 h-5 text-primary mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Existing Connections (for ODBC/QVD) */}
      {(selectedType === 'odbc' || selectedType === 'qvd') && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="font-medium mb-4">Use Existing Connection</h2>
          {isLoadingConnections ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <LoadingSpinner size="sm" />
              <span className="text-muted-foreground">Loading connections...</span>
            </div>
          ) : qlikConnections && qlikConnections.length > 0 ? (
            <div className="space-y-2">
              {qlikConnections.map((conn) => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => handleSelectExistingConnection(conn)}
                  className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                    connection?.id === conn.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{conn.name}</p>
                    <p className="text-sm text-muted-foreground">{conn.type}</p>
                  </div>
                  {connection?.id === conn.id ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No existing connections found.
            </p>
          )}
        </div>
      )}

      {/* New Connection Form */}
      {selectedType === 'odbc' && !connection?.validated && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="font-medium mb-4">Or Create New Connection</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Connection Name</label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="My Database Connection"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Connection String</label>
              <textarea
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="Server=myserver;Database=mydb;User Id=user;Password=***;"
                rows={3}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter your ODBC connection string. Credentials will be encrypted.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!connectionString || testConnection.isPending}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
              >
                {testConnection.isPending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Testing...
                  </span>
                ) : (
                  'Test Connection'
                )}
              </button>
              {testConnection.data?.success && (
                <StatusBadge status="success" label="Connection successful" />
              )}
              {testConnection.data && !testConnection.data.success && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {testConnection.data.error || 'Connection failed'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Table Selection
        </button>
      </div>
    </div>
  )
}

export default SourceStep
