/**
 * Step 5: Incremental
 * Configure incremental load strategy
 */
import { useState } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import { RefreshCw, Plus, Check } from 'lucide-react'
import type { IncrementalStrategy } from '@/types/wizard.types'

const strategyOptions: { value: IncrementalStrategy; label: string; description: string }[] = [
  {
    value: 'full_reload',
    label: 'Full Reload',
    description: 'Replace all data on each extraction (simplest, but slower for large tables)',
  },
  {
    value: 'insert_only',
    label: 'Insert Only',
    description: 'Only add new records based on a key field (good for append-only data)',
  },
  {
    value: 'upsert',
    label: 'Upsert (Insert + Update)',
    description: 'Add new records and update existing ones based on a key field',
  },
  {
    value: 'delete_insert',
    label: 'Delete + Insert',
    description: 'Delete records within a date range and re-insert (good for late-arriving data)',
  },
]

export function IncrementalStep() {
  const { nextStep, prevStep } = useAppStore()
  const { tables, setTableIncremental } = useWizardStore()

  const [selectedTable, setSelectedTable] = useState<string | null>(
    tables.length > 0 ? tables[0].name : null
  )

  const currentTable = tables.find((t) => t.name === selectedTable)

  const handleStrategyChange = (strategy: IncrementalStrategy) => {
    if (!selectedTable) return
    setTableIncremental(selectedTable, {
      enabled: strategy !== 'full_reload',
      strategy,
      keyField: currentTable?.incremental?.keyField,
      timestampField: currentTable?.incremental?.timestampField,
    })
  }

  const handleKeyFieldChange = (field: string) => {
    if (!selectedTable || !currentTable?.incremental) return
    setTableIncremental(selectedTable, {
      ...currentTable.incremental,
      keyField: field,
    })
  }

  const handleTimestampFieldChange = (field: string) => {
    if (!selectedTable || !currentTable?.incremental) return
    setTableIncremental(selectedTable, {
      ...currentTable.incremental,
      timestampField: field,
    })
  }

  const applyToAll = () => {
    if (!currentTable?.incremental) return
    tables.forEach((table) => {
      if (table.name !== selectedTable) {
        // Try to find matching fields by name
        const keyField = table.fields.find((f) => f.isPrimaryKey)?.name
        const timestampField = table.fields.find(
          (f) => f.dataType === 'datetime' || f.dataType === 'date'
        )?.name

        setTableIncremental(table.name, {
          ...currentTable.incremental!,
          keyField: keyField || currentTable.incremental!.keyField,
          timestampField: timestampField || currentTable.incremental!.timestampField,
        })
      }
    })
  }

  const currentStrategy = currentTable?.incremental?.strategy || 'full_reload'
  const dateFields = currentTable?.fields.filter(
    (f) => f.dataType === 'datetime' || f.dataType === 'date'
  )
  const keyFields = currentTable?.fields.filter((f) => f.isPrimaryKey || f.isBusinessKey)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 5: Incremental Load</h1>
        <p className="text-muted-foreground">
          Configure how data should be loaded on subsequent extractions.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Table List */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-3 border-b bg-muted/50">
            <h3 className="font-medium text-sm">Tables</h3>
          </div>
          <div className="divide-y max-h-[400px] overflow-auto">
            {tables.map((table) => (
              <button
                key={table.name}
                type="button"
                onClick={() => setSelectedTable(table.name)}
                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                  selectedTable === table.name
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-sm truncate">{table.name}</span>
                {table.incremental?.enabled && (
                  <RefreshCw className="w-4 h-4 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration */}
        <div className="md:col-span-2 space-y-6">
          {currentTable ? (
            <>
              {/* Strategy Selection */}
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-medium mb-4">Load Strategy for {currentTable.name}</h3>
                <div className="space-y-2">
                  {strategyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleStrategyChange(option.value)}
                      className={`w-full flex items-start gap-3 p-3 border rounded-lg text-left transition-colors ${
                        currentStrategy === option.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                          currentStrategy === option.value
                            ? 'bg-primary border-primary text-white'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {currentStrategy === option.value && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Configuration */}
              {currentStrategy !== 'full_reload' && (
                <div className="bg-card border rounded-lg p-4">
                  <h3 className="font-medium mb-4">Configuration</h3>
                  <div className="space-y-4">
                    {(currentStrategy === 'insert_only' || currentStrategy === 'upsert') && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Key Field</label>
                        <select
                          value={currentTable.incremental?.keyField || ''}
                          onChange={(e) => handleKeyFieldChange(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Select key field...</option>
                          {keyFields?.map((field) => (
                            <option key={field.name} value={field.name}>
                              {field.name} {field.isPrimaryKey && '(PK)'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {currentStrategy === 'delete_insert' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Timestamp Field</label>
                        <select
                          value={currentTable.incremental?.timestampField || ''}
                          onChange={(e) => handleTimestampFieldChange(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Select timestamp field...</option>
                          {dateFields?.map((field) => (
                            <option key={field.name} value={field.name}>
                              {field.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Apply to All */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={applyToAll}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Apply this strategy to all tables
                </button>
              </div>
            </>
          ) : (
            <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
              Select a table to configure its incremental load strategy.
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={prevStep}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={nextStep}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Continue to Extract
        </button>
      </div>
    </div>
  )
}

export default IncrementalStep
