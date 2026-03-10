import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || ''

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [livePrice, setLivePrice] = useState(null)
  const [newEventCount, setNewEventCount] = useState(0)
  const sseRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/dashboard`)
      if (res.data.success) setData(res.data.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // SSE 实时连接
  useEffect(() => {
    const es = new EventSource(`${BASE}/api/stream`)
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'price' && msg.price) {
          setLivePrice(msg.price)
        }
        if (msg.type === 'update') {
          // 有新事件，重新拉取全量数据
          if (msg.newEvents > 0) setNewEventCount(n => n + msg.newEvents)
          fetchAll()
        }
        if (msg.type === 'verified') {
          fetchAll()
        }
      } catch {}
    }

    es.onerror = () => {
      // SSE 断开后 5s 重连（浏览器原生会自动重连，这里只打日志）
      console.warn('[SSE] connection error, browser will retry...')
    }

    return () => es.close()
  }, [fetchAll])

  // 初始加载
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await axios.post(`${BASE}/api/events/refresh`)
      await axios.post(`${BASE}/api/predictions/auto`)
      await axios.post(`${BASE}/api/predictions/verify`)
      await fetchAll()
      setNewEventCount(0)
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }, [fetchAll])

  return { data, loading, error, refresh, refreshing, livePrice, newEventCount }
}
