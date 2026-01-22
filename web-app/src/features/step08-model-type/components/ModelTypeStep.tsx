/**
 * Step 8: Model Type
 * Select data model type with AI recommendations
 */
import { useEffect } from 'react'
import { useAppStore, useModelBuilderStore } from '@/store'
import { useSetModelType, useGeminiRecommendation } from '@/api'
import { LoadingSpinner } from '@/shared'
import { Star, Snowflake, Link2, Layers, Check, Sparkles, AlertCircle } from 'lucide-react'
import type { ModelType } from '@/types/model-builder.types'

interface ModelTypeOption {
  type: ModelType
  name: string
  description: string
  icon: React.ReactNode
  pros: string[]
  cons: string[]
}

const modelTypeOptions: ModelTypeOption[] = [
  {
    type: 'star_schema',
    name: 'Star Schema',
    description: 'Central fact table connected to dimension tables. Best for simple, fast queries.',
    icon: <Star className="w-6 h-6" />,
    pros: ['Fastest query performance', 'Easy to understand', 'Minimal joins'],
    cons: ['Data redundancy in dimensions', 'Not ideal for complex hierarchies'],
  },
  {
    type: 'snowflake',
    name: 'Snowflake Schema',
    description: 'Normalized dimension tables with sub-dimensions. Best for complex hierarchies.',
    icon: <Snowflake className="w-6 h-6" />,
    pros: ['Reduced data redundancy', 'Handles complex hierarchies', 'More normalized'],
    cons: ['More complex queries', 'Slower performance due to joins'],
  },
  {
    type: 'link_table',
    name: 'Link Table Model',
    description: 'Generic keys with link tables. Best for associative data exploration.',
    icon: <Link2 className="w-6 h-6" />,
    pros: ['Handles many-to-many well', 'Flexible associations', 'Good for Qlik'],
    cons: ['More complex to build', 'Requires careful key management'],
  },
  {
    type: 'normalized',
    name: 'Normalized Model',
    description: 'Fully normalized tables. Best when data integrity is paramount.',
    icon: <Layers className="w-6 h-6" />,
    pros: ['No data redundancy', 'Highest data integrity', 'Flexible'],
    cons: ['Many joins required', 'Complex queries', 'Slower for analytics'],
  },
]

export function ModelTypeStep() {
  const { nextStep, prevStep } = useAppStore()
  const {
    sessionId,
    analysisResult,
    modelType,
    setModelType,
    setEnrichedSpec,
    enableGeminiValidation,
  } = useModelBuilderStore()

  // Set model type mutation
  const setModelTypeMutation = useSetModelType()

  // Gemini recommendation mutation
  const geminiRecommendation = useGeminiRecommendation()

  // Get Gemini recommendation when entering this step
  useEffect(() => {
    if (enableGeminiValidation && analysisResult && !geminiRecommendation.data && !geminiRecommendation.isPending) {
      const tables = analysisResult.tables.map(t => ({
        name: t.name,
        classification: t.classification,
        metrics: { rowCount: t.metrics.rowCount }
      }))
      geminiRecommendation.mutate(tables)
    }
  }, [analysisResult, enableGeminiValidation])

  const handleSelectModelType = (type: ModelType) => {
    setModelType(type)
  }

  const handleConfirm = async () => {
    if (!sessionId || !modelType) return

    const result = await setModelTypeMutation.mutateAsync({
      sessionId,
      modelType,
    })
    setEnrichedSpec(result)
    nextStep()
  }

  const recommendedType = geminiRecommendation.data?.recommendedType ||
    analysisResult?.recommendedModelType ||
    'star_schema'

  const isLoading = setModelTypeMutation.isPending || geminiRecommendation.isPending
  const hasError = setModelTypeMutation.isError

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 8: Select Model Type</h1>
        <p className="text-muted-foreground">
          Choose the data model architecture for your Qlik application.
        </p>
      </div>

      {/* AI Recommendation */}
      {enableGeminiValidation && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-purple-800">AI Recommendation</p>
                {geminiRecommendation.isPending && (
                  <LoadingSpinner size="sm" />
                )}
              </div>
              {geminiRecommendation.data ? (
                <>
                  <p className="text-sm text-purple-700 mt-1">
                    Based on your data analysis, we recommend{' '}
                    <strong>{modelTypeOptions.find(o => o.type === geminiRecommendation.data?.recommendedType)?.name}</strong>
                    {' '}with {Math.round((geminiRecommendation.data.confidence || 0) * 100)}% confidence.
                  </p>
                  <p className="text-sm text-purple-600 mt-2">
                    {geminiRecommendation.data.reasoning}
                  </p>
                </>
              ) : analysisResult ? (
                <p className="text-sm text-purple-700 mt-1">
                  Initial analysis suggests{' '}
                  <strong>{modelTypeOptions.find(o => o.type === analysisResult.recommendedModelType)?.name}</strong>.
                </p>
              ) : (
                <p className="text-sm text-purple-700 mt-1">
                  Analyzing your data structure...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Model Type Selection */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {modelTypeOptions.map((option) => {
          const isSelected = modelType === option.type
          const isRecommended = option.type === recommendedType

          return (
            <button
              key={option.type}
              type="button"
              onClick={() => handleSelectModelType(option.type)}
              className={`relative text-left p-5 border rounded-lg transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'hover:border-muted-foreground/50'
              }`}
            >
              {isRecommended && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                  Recommended
                </span>
              )}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  isSelected ? 'bg-primary/10 text-primary' : 'bg-muted'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{option.name}</p>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </div>

              {/* Pros/Cons */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-medium text-green-700 mb-1">Pros</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {option.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">+</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-red-700 mb-1">Cons</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {option.cons.map((con, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-red-500 mt-0.5">-</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Error Display */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>{setModelTypeMutation.error?.message || 'Failed to set model type'}</span>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {modelType && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800">
              Selected: <strong>{modelTypeOptions.find(o => o.type === modelType)?.name}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={isLoading}
          className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!modelType || isLoading}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              Processing...
            </>
          ) : (
            'Continue to Build'
          )}
        </button>
      </div>
    </div>
  )
}

export default ModelTypeStep
