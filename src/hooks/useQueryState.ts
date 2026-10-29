import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A string value stored in the URL query (e.g. ?status=Approved), so filters
 * survive navigation and can be linked from the dashboard and notifications.
 */
export function useQueryState<T extends string = string>(key: string, fallback = '' as T): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams()
  const value = (params.get(key) ?? fallback) as T
  const setValue = useCallback(
    (v: T) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === '' || v === fallback) next.delete(key)
          else next.set(key, v)
          return next
        },
        { replace: true },
      )
    },
    [key, fallback, setParams],
  )
  return [value, setValue]
}

/** Active tab stored as ?tab=…; switching tabs clears the previous tab's filters. */
export function useTabParam<T extends string>(fallback: T): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams()
  const value = (params.get('tab') ?? fallback) as T
  const setValue = useCallback(
    (v: T) => setParams(v === fallback ? {} : { tab: v }, { replace: true }),
    [fallback, setParams],
  )
  return [value, setValue]
}
