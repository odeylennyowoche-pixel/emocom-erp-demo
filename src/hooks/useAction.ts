import { useCallback } from 'react'
import { DomainError } from '../data/actions'
import { useToast } from '../components/ui/toast-context'

/**
 * Wraps a state-changing operation with consistent success/error feedback.
 * Returns true when the operation succeeded.
 */
export function useAction() {
  const toast = useToast()
  return useCallback(
    (run: () => void, success?: { title: string; description?: string }): boolean => {
      try {
        run()
        if (success) toast.success(success.title, success.description)
        return true
      } catch (err) {
        const message = err instanceof DomainError ? err.message : 'Something went wrong. Please try again.'
        if (!(err instanceof DomainError)) console.error(err)
        toast.error('Action not completed', message)
        return false
      }
    },
    [toast],
  )
}
