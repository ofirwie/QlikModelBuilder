import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle, XCircle, Database, Link, Table } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

interface ValidationCheck {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'passed' | 'warning' | 'failed'
  details?: string
}

const initialChecks: ValidationCheck[] = [
  {
    id: '1',
    name: 'Data Model Structure',
    description: 'Verifying star schema integrity',
    status: 'pending',
  },
  {
    id: '2',
    name: 'Key Relationships',
    description: 'Checking foreign key references',
    status: 'pending',
  },
  {
    id: '3',
    name: 'Circular References',
    description: 'Detecting circular loops in data model',
    status: 'pending',
  },
  {
    id: '4',
    name: 'Synthetic Keys',
    description: 'Checking for unwanted synthetic keys',
    status: 'pending',
  },
  {
    id: '5',
    name: 'Data Quality',
    description: 'Validating data completeness and accuracy',
    status: 'pending',
  },
  {
    id: '6',
    name: 'Performance Metrics',
    description: 'Analyzing query performance',
    status: 'pending',
  },
]

// Simulated validation results
const validationResults: Record<string, { status: 'passed' | 'warning' | 'failed'; details?: string }> = {
  '1': { status: 'passed', details: 'Star schema structure is valid' },
  '2': { status: 'passed', details: 'All foreign keys reference valid primary keys' },
  '3': { status: 'passed', details: 'No circular references detected' },
  '4': { status: 'warning', details: '1 synthetic key detected between CustomerDim and SalesFact' },
  '5': { status: 'passed', details: 'Data quality score: 98.5%' },
  '6': { status: 'passed', details: 'Average query time: 45ms' },
}

export function ValidatePage() {
  const navigate = useNavigate()
  const { setPhase } = useAppStore()
  const [checks, setChecks] = useState<ValidationCheck[]>(initialChecks)
  const [isRunning, setIsRunning] = useState(false)
  const [currentCheck, setCurrentCheck] = useState(0)

  const completedChecks = checks.filter(c => c.status !== 'pending' && c.status !== 'running').length
  const progress = (completedChecks / checks.length) * 100
  const hasFailures = checks.some(c => c.status === 'failed')
  const hasWarnings = checks.some(c => c.status === 'warning')
  const allPassed = checks.every(c => c.status === 'passed' || c.status === 'warning')

  const runValidation = () => {
    setIsRunning(true)
    setCurrentCheck(0)
    setChecks(initialChecks)
  }

  useEffect(() => {
    if (!isRunning) return

    if (currentCheck >= checks.length) {
      setIsRunning(false)
      return
    }

    // Set current check to running
    setChecks(prev => prev.map((c, i) =>
      i === currentCheck ? { ...c, status: 'running' } : c
    ))

    // Simulate validation delay
    const timer = setTimeout(() => {
      const result = validationResults[checks[currentCheck].id]
      setChecks(prev => prev.map((c, i) =>
        i === currentCheck ? { ...c, status: result.status, details: result.details } : c
      ))
      setCurrentCheck(prev => prev + 1)
    }, 800)

    return () => clearTimeout(timer)
  }, [isRunning, currentCheck, checks.length])

  const getStatusIcon = (status: ValidationCheck['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-success" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-error" />
      case 'running':
        return <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
    }
  }

  const handleProceed = () => {
    setPhase('deploy')
    navigate('/deploy')
  }

  const handleBack = () => {
    setPhase('build')
    navigate('/build')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Model Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Model Validation</CardTitle>
          <CardDescription>
            Running comprehensive validation checks on your data model
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Model Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Database className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Tables</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Link className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-sm text-muted-foreground">Relationships</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Table className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">24</p>
                <p className="text-sm text-muted-foreground">Fields</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Validation Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Validation Checks */}
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  check.status === 'running' ? 'border-primary bg-primary/5' :
                  check.status === 'passed' ? 'border-success/30 bg-success/5' :
                  check.status === 'warning' ? 'border-warning/30 bg-warning/5' :
                  check.status === 'failed' ? 'border-error/30 bg-error/5' :
                  'border-border'
                }`}
              >
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <p className="font-medium">{check.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {check.details || check.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            {!isRunning && completedChecks === 0 && (
              <Button onClick={runValidation}>
                Run Validation
              </Button>
            )}
            {!isRunning && completedChecks > 0 && (
              <>
                <Button onClick={handleProceed} disabled={hasFailures}>
                  {allPassed ? 'Proceed to Deploy' : 'Proceed with Warnings'}
                </Button>
                <Button variant="outline" onClick={runValidation}>
                  Re-run Validation
                </Button>
                <Button variant="outline" onClick={handleBack}>
                  Back to Build
                </Button>
              </>
            )}
          </div>

          {/* Summary */}
          {!isRunning && completedChecks === checks.length && (
            <div className={`mt-6 p-4 rounded-lg ${
              hasFailures ? 'bg-error/10 text-error' :
              hasWarnings ? 'bg-warning/10 text-warning' :
              'bg-success/10 text-success'
            }`}>
              {hasFailures ? (
                <p className="font-medium">Validation failed. Please fix the issues before proceeding.</p>
              ) : hasWarnings ? (
                <p className="font-medium">Validation passed with warnings. Review before proceeding.</p>
              ) : (
                <p className="font-medium">All validation checks passed successfully!</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
