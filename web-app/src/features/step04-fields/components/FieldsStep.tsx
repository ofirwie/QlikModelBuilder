/**
 * Step 4: Fields
 * Map fields and configure types
 */
import { useState } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import { ChevronDown, ChevronRight, Key, Link, Hash, Type, Calendar, ToggleLeft } from 'lucide-react'
import type { FieldDataType } from '@/types/wizard.types'

const dataTypeOptions: { value: FieldDataType; label: string; icon: React.ReactNode }[] = [
  { value: 'string', label: 'String', icon: <Type className="w-4 h-4" /> },
  { value: 'integer', label: 'Integer', icon: <Hash className="w-4 h-4" /> },
  { value: 'decimal', label: 'Decimal', icon: <Hash className="w-4 h-4" /> },
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { value: 'datetime', label: 'DateTime', icon: <Calendar className="w-4 h-4" /> },
  { value: 'boolean', label: 'Boolean', icon: <ToggleLeft className="w-4 h-4" /> },
]

export function FieldsStep() {
  const { nextStep, prevStep } = useAppStore()
  const { tables, updateTable } = useWizardStore()

  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    new Set(tables.slice(0, 2).map((t) => t.name))
  )

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const handleFieldUpdate = (
    tableName: string,
    fieldName: string,
    updates: { isPrimaryKey?: boolean; isForeignKey?: boolean; isBusinessKey?: boolean; dataType?: FieldDataType }
  ) => {
    const table = tables.find((t) => t.name === tableName)
    if (!table) return

    const updatedFields = table.fields.map((field) =>
      field.name === fieldName ? { ...field, ...updates } : field
    )

    updateTable(tableName, { fields: updatedFields })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 4: Map Fields</h1>
        <p className="text-muted-foreground">
          Configure field types and key designations for your selected tables.
        </p>
      </div>

      {/* Legend */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">PK</span>
            <span className="text-muted-foreground">Primary Key</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">FK</span>
            <span className="text-muted-foreground">Foreign Key</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">BK</span>
            <span className="text-muted-foreground">Business Key</span>
          </div>
        </div>
      </div>

      {/* Tables Accordion */}
      <div className="space-y-4 mb-6">
        {tables.map((table) => {
          const isExpanded = expandedTables.has(table.name)
          const pkCount = table.fields.filter((f) => f.isPrimaryKey).length
          const fkCount = table.fields.filter((f) => f.isForeignKey).length

          return (
            <div key={table.name} className="bg-card border rounded-lg overflow-hidden">
              {/* Table Header */}
              <button
                type="button"
                onClick={() => toggleTable(table.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{table.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {table.fields.length} fields
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pkCount > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                      {pkCount} PK
                    </span>
                  )}
                  {fkCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                      {fkCount} FK
                    </span>
                  )}
                </div>
              </button>

              {/* Fields List */}
              {isExpanded && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Field</th>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-center font-medium">PK</th>
                        <th className="px-4 py-2 text-center font-medium">FK</th>
                        <th className="px-4 py-2 text-center font-medium">BK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {table.fields.map((field) => (
                        <tr key={field.name} className="hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {field.isPrimaryKey && <Key className="w-4 h-4 text-yellow-600" />}
                              {field.isForeignKey && <Link className="w-4 h-4 text-blue-600" />}
                              <span className="font-mono text-sm">{field.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={field.dataType}
                              onChange={(e) =>
                                handleFieldUpdate(table.name, field.name, {
                                  dataType: e.target.value as FieldDataType,
                                })
                              }
                              className="px-2 py-1 border rounded text-sm w-32"
                            >
                              {dataTypeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={field.isPrimaryKey}
                              onChange={(e) =>
                                handleFieldUpdate(table.name, field.name, {
                                  isPrimaryKey: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={field.isForeignKey}
                              onChange={(e) =>
                                handleFieldUpdate(table.name, field.name, {
                                  isForeignKey: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={field.isBusinessKey}
                              onChange={(e) =>
                                handleFieldUpdate(table.name, field.name, {
                                  isBusinessKey: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded border-gray-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

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
          onClick={nextStep}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Continue to Incremental Load
        </button>
      </div>
    </div>
  )
}

export default FieldsStep
