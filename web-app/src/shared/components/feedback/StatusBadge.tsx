/**
 * Status Badge Component
 * Displays status indicators with different styles
 */

type Status = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'running'

interface StatusBadgeProps {
  status: Status
  label?: string
  showDot?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusStyles: Record<Status, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  pending: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
  running: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    dot: 'bg-purple-500 animate-pulse',
  },
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

const defaultLabels: Record<Status, string> = {
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Info',
  pending: 'Pending',
  running: 'Running',
}

export function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const styles = statusStyles[status]
  const displayLabel = label || defaultLabels[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${styles.bg} ${styles.text} ${sizeClasses[size]} ${className}`}
    >
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      )}
      {displayLabel}
    </span>
  )
}

export default StatusBadge
