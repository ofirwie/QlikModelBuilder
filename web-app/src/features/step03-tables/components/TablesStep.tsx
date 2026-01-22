/**
 * Step 3: Tables
 * Select tables for extraction
 */
import { useState, useMemo } from 'react'
import { useAppStore, useWizardStore } from '@/store'
import { useSchema } from '@/api'
import { LoadingSpinner, EmptyState } from '@/shared'
import { Table2, Search, Check, Square, CheckSquare, Database, AlertCircle } from 'lucide-react'
import type { SchemaTable, SchemaColumn } from '@/api/clients/wizard-client'

export function TablesStep() {
  const { nextStep, prevStep } = useAppStore()
  const { connection, tables, setTables } = useWizardStore()

  const [searchQuery, setSearchQuery] = useState('')

  // Fetch schema from connection
  const { data: schema, isLoading, error } = useSchema(connection)

  // Filter tables by search query
  const filteredTables = useMemo(() => {
    if (!schema) return []
    if (!searchQuery) return schema
    const query = searchQuery.toLowerCase()
    return schema.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.schema?.toLowerCase().includes(query)
    )
  }, [schema, searchQuery])

  // Track selected table names
  const selectedTableNames = new Set(tables.map((t) => t.name))

  const handleToggleTable = (table: SchemaTable) => {
    if (selectedTableNames.has(table.name)) {
      // Remove table
      setTables(tables.filter((t) => t.name !== table.name))
    } else {
      // Add table
      setTables([
        ...tables,
        {
          name: table.name,
          schema: table.schema,
          fields: table.columns.map((col: SchemaColumn) => ({
            name: col.name,
            dataType: col.dataType as any,
            isPrimaryKey: col.isPrimaryKey,
            isForeignKey: false,
            isBusinessKey: false,
            isNullable: col.isNullable,
          })),
          rowCount: table.rowCount,
          selected: true,
        },
      ])
    }
  }

  const handleSelectAll = () => {
    if (!schema) return
    if (selectedTableNames.size === schema.length) {
      // Deselect all
      setTables([])
    } else {
      // Select all
      setTables(
        schema.map((table) => ({
          name: table.name,
          schema: table.schema,
          fields: table.columns.map((col) => ({
            name: col.name,
            dataType: col.dataType as any,
            isPrimaryKey: col.isPrimaryKey,
            isForeignKey: false,
            isBusinessKey: false,
            isNullable: col.isNullable,
          })),
          rowCount: table.rowCount,
          selected: true,
        }))
      )
    }
  }

  const canProceed = tables.length > 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Step 3: Select Tables</h1>
        <p className="text-muted-foreground">
          Choose the tables you want to extract from your data source.
        </p>
      </div>

      {/* Search and Actions */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables..."
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={!schema || schema.length === 0}
            className="px-4 py-2 border rounded-md hover:bg-muted flex items-center gap-2 disabled:opacity-50"
          >
            {selectedTableNames.size === schema?.length ? (
              <>
                <CheckSquare className="w-4 h-4" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Select All
              </>
            )}
          </button>
        </div>
        {schema && (
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{schema.length} tables found</span>
            <span>•</span>
            <span>{selectedTableNames.size} selected</span>
          </div>
        )}
      </div>

      {/* Tables List */}
      <div className="bg-card border rounded-lg mb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-muted-foreground">Loading schema...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Failed to load schema. Please check your connection.</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <EmptyState
            icon={<Database className="w-12 h-12" />}
            title={searchQuery ? 'No tables found' : 'No tables available'}
            description={
              searchQuery
                ? 'Try adjusting your search query'
                : 'The selected connection has no tables'
            }
          />
        ) : (
          <div className="divide-y">
            {filteredTables.map((table) => {
              const isSelected = selectedTableNames.has(table.name)
              return (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => handleToggleTable(table)}
                  className={`w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <Table2 className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {table.schema ? `${table.schema}.${table.name}` : table.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {table.columns.length} columns
                      {table.rowCount !== undefined && ` • ${table.rowCount.toLocaleString()} rows`}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {table.columns.filter((c) => c.isPrimaryKey).length > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs mr-2">
                        PK
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Tables Summary */}
      {tables.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>{tables.length}</strong> table{tables.length > 1 ? 's' : ''} selected for extraction
          </p>
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
          onClick={nextStep}
          disabled={!canProceed}
          data-testid="next-button"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Field Mapping
        </button>
      </div>
    </div>
  )
}

export default TablesStep
