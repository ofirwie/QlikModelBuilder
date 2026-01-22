import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useState } from 'react'

// Demo scripts for each chapter
const chapterScripts: Record<string, string> = {
  '1': `// Calendar Dimension
CalendarDim:
LOAD
    Date,
    Year(Date) as Year,
    Month(Date) as Month,
    Day(Date) as Day,
    WeekDay(Date) as WeekDay,
    Quarter(Date) as Quarter
FROM [lib://DataFiles/Calendar.qvd] (qvd);`,
  '2': `// Customer Dimension
CustomerDim:
LOAD
    CustomerID,
    CustomerName,
    Segment,
    Region,
    Country,
    City
FROM [lib://DataFiles/Customers.qvd] (qvd);`,
  '3': `// Product Dimension
ProductDim:
LOAD
    ProductID,
    ProductName,
    Category,
    SubCategory,
    Brand,
    UnitPrice
FROM [lib://DataFiles/Products.qvd] (qvd);`,
  '4': `// Sales Fact Table
SalesFact:
LOAD
    OrderID,
    CustomerID,
    ProductID,
    OrderDate,
    Quantity,
    Sales,
    Profit,
    Discount
FROM [lib://DataFiles/Sales.qvd] (qvd);`,
  '5': `// Link Table for M:N relationships
LinkTable:
LOAD DISTINCT
    CustomerID & '|' & ProductID as LinkKey,
    CustomerID,
    ProductID
RESIDENT SalesFact;`,
}

// Demo validations for each chapter
const chapterValidations: Record<string, { type: 'success' | 'warning' | 'error'; message: string }[]> = {
  '1': [
    { type: 'success', message: 'Table structure validated' },
    { type: 'success', message: 'Date field parsed correctly' },
    { type: 'success', message: 'All temporal fields generated' },
  ],
  '2': [
    { type: 'success', message: 'Table structure validated' },
    { type: 'success', message: 'Primary key (CustomerID) is unique' },
    { type: 'success', message: 'No null values in required fields' },
  ],
  '3': [
    { type: 'success', message: 'Table structure validated' },
    { type: 'success', message: 'Primary key (ProductID) is unique' },
    { type: 'warning', message: '5 duplicate ProductName values detected' },
  ],
  '4': [
    { type: 'success', message: 'Table structure validated' },
    { type: 'success', message: 'Foreign keys reference valid dimensions' },
    { type: 'warning', message: '12 orders with negative profit values' },
  ],
  '5': [
    { type: 'success', message: 'Link table created successfully' },
    { type: 'success', message: 'Composite key is unique' },
    { type: 'success', message: 'All relationships established' },
  ],
}

export function BuildPage() {
  const navigate = useNavigate()
  const { chapters, updateChapterStatus, setPhase } = useAppStore()
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [currentWarning, setCurrentWarning] = useState<string | null>(null)

  const currentChapter = chapters.find((c) => c.status === 'current')
  const currentIndex = currentChapter ? chapters.findIndex((c) => c.id === currentChapter.id) : -1
  const script = currentChapter ? chapterScripts[currentChapter.id] || '' : ''
  const validations = currentChapter ? chapterValidations[currentChapter.id] || [] : []

  const hasWarnings = validations.some((v) => v.type === 'warning')
  const hasErrors = validations.some((v) => v.type === 'error')

  const getIcon = (type: 'success' | 'warning' | 'error') => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />
      case 'error':
        return <XCircle className="w-4 h-4 text-error" />
    }
  }

  const handleApprove = () => {
    if (!currentChapter) return

    // Mark current as completed
    updateChapterStatus(currentChapter.id, 'completed')

    // Check if there's a next chapter
    if (currentIndex < chapters.length - 1) {
      const nextChapter = chapters[currentIndex + 1]
      updateChapterStatus(nextChapter.id, 'current')
    } else {
      // All chapters done, move to Validate phase
      setPhase('validate')
      navigate('/validate')
    }
  }

  const handleReviewWarning = () => {
    const warning = validations.find((v) => v.type === 'warning')
    if (warning) {
      setCurrentWarning(warning.message)
      setShowWarningDialog(true)
    }
  }

  const handleStop = () => {
    // In a real app, this would stop the build process
    navigate('/plan')
  }

  if (!currentChapter) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No chapters to build. Please go back to the Plan phase.</p>
            <Button onClick={() => navigate('/plan')} className="mt-4">
              Back to Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chapter {currentIndex + 1}: {currentChapter.name}</CardTitle>
          <CardDescription>
            Building {currentChapter.name.toLowerCase()} with validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Generated Script */}
          <div className="bg-muted rounded-lg p-4 font-mono text-sm">
            <pre className="text-foreground whitespace-pre-wrap">{script}</pre>
          </div>

          {/* Validation Results */}
          <div className="mt-6 space-y-4">
            <h3 className="font-medium">Validation Results</h3>

            <div className="space-y-2">
              {validations.map((validation, index) => (
                <div key={index} className="flex items-center gap-2">
                  {getIcon(validation.type)}
                  <span className={
                    validation.type === 'success' ? 'text-success' :
                    validation.type === 'warning' ? 'text-warning' :
                    'text-error'
                  }>
                    {validation.message}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleApprove} disabled={hasErrors}>
                {currentIndex < chapters.length - 1 ? 'Approve & Continue' : 'Approve & Finish'}
              </Button>
              {hasWarnings && (
                <Button variant="outline" onClick={handleReviewWarning}>
                  Review Warning
                </Button>
              )}
              <Button variant="outline" onClick={handleStop}>
                Stop & Investigate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Warning Details
            </DialogTitle>
            <DialogDescription>
              {currentWarning}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This warning indicates a potential data quality issue. You can:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
              <li>Continue with the build (warning will be logged)</li>
              <li>Stop and investigate the source data</li>
              <li>Add data cleansing rules to handle this case</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowWarningDialog(false)
              handleApprove()
            }}>
              Continue Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
