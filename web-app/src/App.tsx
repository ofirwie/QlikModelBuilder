import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Demo data for the Build phase
const demoChapters = [
  { id: '1', name: 'Calendar Dimension', status: 'completed' as const },
  { id: '2', name: 'Customer Dimension', status: 'completed' as const },
  { id: '3', name: 'Product Dimension', status: 'current' as const },
  { id: '4', name: 'Sales Fact Table', status: 'pending' as const },
  { id: '5', name: 'Link Tables', status: 'pending' as const },
]

function App() {
  return (
    <Layout
      projectName="Sales Analytics Model"
      currentPhase="build"
      chapters={demoChapters}
      buildProgress={{
        currentChapter: 3,
        totalChapters: 5,
      }}
    >
      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Chapter 3: Product Dimension</CardTitle>
            <CardDescription>
              Building the product dimension table with hierarchy support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm">
              <pre className="text-foreground">{`// Generated Qlik Script
ProductDim:
LOAD
    ProductID,
    ProductName,
    Category,
    SubCategory,
    Brand,
    UnitPrice
FROM [lib://DataFiles/Products.qvd] (qvd);`}</pre>
            </div>

            <div className="mt-6 space-y-4">
              <h3 className="font-medium">Validation Results</h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-success">
                  <span>✅</span>
                  <span>Table structure validated</span>
                </div>
                <div className="flex items-center gap-2 text-success">
                  <span>✅</span>
                  <span>Primary key (ProductID) is unique</span>
                </div>
                <div className="flex items-center gap-2 text-warning">
                  <span>⚠️</span>
                  <span>5 duplicate ProductName values detected</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button>Approve & Continue</Button>
                <Button variant="outline">Review Warning</Button>
                <Button variant="outline">Stop & Investigate</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default App
