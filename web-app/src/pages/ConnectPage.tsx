import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

export function ConnectPage() {
  const navigate = useNavigate()
  const { connection, setConnection, setProjectName, setPhase } = useAppStore()
  const [tenantUrl, setTenantUrl] = useState(connection.tenantUrl || '')
  const [projectName, setProjectNameLocal] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    if (!tenantUrl || !projectName) {
      setError('Please fill in all fields')
      return
    }

    setIsConnecting(true)
    setError('')

    // Simulate connection (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1500))

    // For demo, always succeed
    setConnection({
      tenantUrl,
      isConnected: true,
      spaceName: 'Personal',
      userId: 'demo@company.com'
    })
    setProjectName(projectName)
    setPhase('plan')
    navigate('/plan')

    setIsConnecting(false)
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Connect to Qlik Cloud</CardTitle>
          <CardDescription>
            Enter your Qlik Cloud tenant URL to begin building your data model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectNameLocal(e.target.value)}
              placeholder="Sales Analytics Model"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Qlik Cloud Tenant URL</label>
            <input
              type="url"
              value={tenantUrl}
              onChange={(e) => setTenantUrl(e.target.value)}
              placeholder="https://your-tenant.qlikcloud.com"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {connection.isConnected && (
            <div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-md">
              <CheckCircle className="w-4 h-4" />
              Connected to {connection.spaceName} as {connection.userId}
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : connection.isConnected ? (
              'Continue to Plan'
            ) : (
              'Connect'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
