import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    try {
      const res = await axios.get('/api/dashboard')
      if (res.data.success) setData(res.data.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 5 * 60 * 1000) // 每5分钟自动刷新
    return () => clearInterval(interval)
  }, [fetch])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await axios.post('/api/events/refresh')
      await axios.post('/api/predictions/auto')
      await fetch()
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }, [fetch])

  return { data, loading, error, refresh, refreshing }
}
