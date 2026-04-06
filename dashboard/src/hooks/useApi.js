import { useState, useEffect, useCallback } from 'react'

export function useApi(fetchFn, deps = [], options = {}) {
  const { pollInterval = null, immediate = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)

  const execute = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchFn()
      if (result) setData(result)
      else setError('No data returned')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    if (immediate) execute()
  }, [execute])

  useEffect(() => {
    if (!pollInterval) return
    const interval = setInterval(execute, pollInterval)
    return () => clearInterval(interval)
  }, [execute, pollInterval])

  return { data, loading, error, refetch: execute }
}
