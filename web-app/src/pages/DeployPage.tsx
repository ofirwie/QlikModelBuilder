import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Cloud, Download, ExternalLink, Rocket, FileCode } from 'lucide-react'
import { useState } from 'react'
import { Progress } from '@/components/ui/progress'

type DeployStatus = 'idle' | 'deploying' | 'success' | 'error'

export function DeployPage() {
  const navigate = useNavigate()
  const { projectName, plan, connection, reset } = useAppStore()
  const [status, setStatus] = useState<DeployStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)

  const handleDeploy = async () => {
    setStatus('deploying')
    setProgress(0)

    // Simulate deployment progress
    const steps = [
      { progress: 20, delay: 500 },
      { progress: 40, delay: 800 },
      { progress: 60, delay: 600 },
      { progress: 80, delay: 700 },
      { progress: 100, delay: 500 },
    ]

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay))
      setProgress(step.progress)
    }

    setStatus('success')
    setDeployedUrl(`${connection.tenantUrl}/sense/app/demo-app-id`)
  }

  const handleDownloadScript = () => {
    // In a real app, this would download the generated Qlik script
    const script = `// Generated Qlik Data Model
// Project: ${projectName}
// Model Type: ${plan.modelType}
// Generated: ${new Date().toISOString()}

// Calendar Dimension
CalendarDim:
LOAD
    Date,
    Year(Date) as Year,
    Month(Date) as Month,
    Day(Date) as Day
FROM [lib://DataFiles/Calendar.qvd] (qvd);

// Customer Dimension
CustomerDim:
LOAD
    CustomerID,
    CustomerName,
    Segment,
    Region
FROM [lib://DataFiles/Customers.qvd] (qvd);

// Product Dimension
ProductDim:
LOAD
    ProductID,
    ProductName,
    Category,
    Brand
FROM [lib://DataFiles/Products.qvd] (qvd);

// Sales Fact Table
SalesFact:
LOAD
    OrderID,
    CustomerID,
    ProductID,
    OrderDate,
    Quantity,
    Sales,
    Profit
FROM [lib://DataFiles/Sales.qvd] (qvd);
`

    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/\s+/g, '_')}_script.qvs`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleNewProject = () => {
    reset()
    navigate('/connect')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Deployment Card */}
      <Card>
        <CardHeader>
          <CardTitle>Deploy to Qlik Cloud</CardTitle>
          <CardDescription>
            Deploy your data model to {connection.tenantUrl || 'Qlik Cloud'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Project Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Project Name</p>
              <p className="font-medium">{projectName || 'Untitled Project'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Model Type</p>
              <p className="font-medium capitalize">{plan.modelType?.replace('_', ' ') || 'N/A'}</p>
            </div>
          </div>

          {/* Deployment Progress */}
          {status === 'deploying' && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="font-medium">Deploying to Qlik Cloud...</span>
              </div>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground mt-2">
                {progress < 30 && 'Preparing deployment package...'}
                {progress >= 30 && progress < 60 && 'Uploading data model...'}
                {progress >= 60 && progress < 90 && 'Configuring application...'}
                {progress >= 90 && 'Finalizing deployment...'}
              </p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="mb-6 p-6 bg-success/10 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
                <div>
                  <h3 className="font-semibold text-success">Deployment Successful!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data model has been deployed to Qlik Cloud
                  </p>
                </div>
              </div>
              {deployedUrl && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Qlik Cloud
                </a>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status === 'idle' && (
              <>
                <Button onClick={handleDeploy} className="gap-2">
                  <Rocket className="w-4 h-4" />
                  Deploy to Qlik Cloud
                </Button>
                <Button variant="outline" onClick={handleDownloadScript} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Script
                </Button>
              </>
            )}
            {status === 'success' && (
              <>
                <Button onClick={handleNewProject} className="gap-2">
                  <Cloud className="w-4 h-4" />
                  Start New Project
                </Button>
                <Button variant="outline" onClick={handleDownloadScript} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Script
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Artifacts */}
      {status === 'success' && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Artifacts</CardTitle>
            <CardDescription>
              Files generated during the build process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Data Model Script</p>
                    <p className="text-sm text-muted-foreground">Qlik load script (.qvs)</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleDownloadScript}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Validation Report</p>
                    <p className="text-sm text-muted-foreground">Model validation results (.json)</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Data Model Documentation</p>
                    <p className="text-sm text-muted-foreground">Technical documentation (.md)</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
