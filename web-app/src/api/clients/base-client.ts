/**
 * Base API Client
 * Common fetch wrapper with error handling and retry logic
 */

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  status?: number
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
}

export class ApiClientError extends Error {
  code: string
  status?: number
  details?: Record<string, unknown>

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiClientError'
    this.code = error.code
    this.status = error.status
    this.details = error.details
  }
}

/**
 * Fetch with retry logic and exponential backoff
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, onRetry } = { ...DEFAULT_RETRY_CONFIG, ...config }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        onRetry?.(attempt, lastError)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Create a base fetch function with common headers and error handling
 */
export function createFetch(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
  return async function baseFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new ApiClientError({
        code: errorBody.code || `HTTP_${response.status}`,
        message: errorBody.message || response.statusText,
        status: response.status,
        details: errorBody.details,
      })
    }

    return response.json()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
