import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

const modelTypes = [
  {
    id: 'star_schema',
    name: 'Star Schema',
    description: 'Central fact table with dimension tables. Best for simple analytics.',
    recommended: true,
  },
  {
    id: 'snowflake',
    name: 'Snowflake Schema',
    description: 'Normalized dimensions (dimensions of dimensions). Better for complex hierarchies.',
  },
  {
    id: 'link_table',
    name: 'Link Table',
    description: 'Uses link tables for M:N relationships. Good for complex relationships.',
  },
  {
    id: 'concatenated',
    name: 'Concatenated Facts',
    description: 'Concatenated fact tables with shared dimensions. For multiple fact tables.',
  },
] as const

export function PlanPage() {
  const navigate = useNavigate()
  const { plan, setPlan, approvePlan, setChapters } = useAppStore()

  const handleSelectModel = (modelType: typeof modelTypes[number]['id']) => {
    setPlan({ modelType })
  }

  const handleApprove = () => {
    // Set demo chapters based on model type
    setChapters([
      { id: '1', name: 'Calendar Dimension', status: 'pending' },
      { id: '2', name: 'Customer Dimension', status: 'pending' },
      { id: '3', name: 'Product Dimension', status: 'pending' },
      { id: '4', name: 'Sales Fact Table', status: 'pending' },
      { id: '5', name: 'Link Tables', status: 'pending' },
    ])
    approvePlan()
    navigate('/build')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Model Type</CardTitle>
          <CardDescription>
            Based on your data structure, choose the best model type for your analytics needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {modelTypes.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelectModel(model.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  plan.modelType === model.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-accent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{model.name}</h3>
                    {'recommended' in model && model.recommended && (
                      <span className="text-xs text-success font-medium">Recommended</span>
                    )}
                  </div>
                  {plan.modelType === model.id && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{model.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {plan.modelType && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Plan</CardTitle>
            <CardDescription>
              The following chapters will be built in sequence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              <li className="flex items-center gap-3 p-2 bg-muted rounded">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center">1</span>
                <span>Build Calendar Dimension</span>
              </li>
              <li className="flex items-center gap-3 p-2 bg-muted rounded">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center">2</span>
                <span>Build Customer Dimension</span>
              </li>
              <li className="flex items-center gap-3 p-2 bg-muted rounded">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center">3</span>
                <span>Build Product Dimension</span>
              </li>
              <li className="flex items-center gap-3 p-2 bg-muted rounded">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center">4</span>
                <span>Build Sales Fact Table</span>
              </li>
              <li className="flex items-center gap-3 p-2 bg-muted rounded">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center">5</span>
                <span>Create Link Tables</span>
              </li>
            </ol>

            <Button onClick={handleApprove} className="w-full mt-6">
              Approve Plan & Start Build
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
