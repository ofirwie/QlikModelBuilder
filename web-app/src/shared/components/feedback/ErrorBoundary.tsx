/**
 * Error Boundary Component
 * Catches and displays React errors gracefully
 */
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // TODO: Send to Sentry when configured
    // Sentry.captureException(error, { extra: { errorInfo } })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorDisplay error={this.state.error} onRetry={this.handleRetry} />
        )
      )
    }

    return this.props.children
  }
}

interface ErrorDisplayProps {
  error: Error | null
  onRetry?: () => void
}

function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {error?.message || 'An unexpected error occurred'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try Again
        </button>
      )}
      {import.meta.env.DEV && error?.stack && (
        <pre className="mt-6 p-4 bg-muted rounded-md text-xs overflow-auto max-w-full max-h-48 text-left">
          {error.stack}
        </pre>
      )}
    </div>
  )
}

export default ErrorBoundary
