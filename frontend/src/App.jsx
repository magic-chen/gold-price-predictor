import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import axios from 'axios'

// 判断 API 基础路径（子路径部署兼容）
// 生产环境：https://www.awsprompts.com/goldpredict/api/xxx → 代理到 http://localhost:3001/api/xxx
// 开发环境：http://localhost:5173/api/xxx → vite proxy 到 3001
const BASE = import.meta.env.VITE_API_BASE || ''

// ── 准确率圆环 ──────────────────────────────────────────────
function AccuracyRing({ rate, total, correct }) {
  const radius = 52
  const circ = 2 * Math.PI * radius
  const offset = circ - (rate / 100) * circ
  const color = rate >= 60 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'
  const wrong = total - correct

  return (
    <div className="card flex flex-col items-center justify-center gap-4 py-6">
      <p className="text-sm text-gray-400 tracking-wide uppercase">预测准确率</p>
      <div className="relative flex items-center justify-center" style={{ width: 130, height: 130 }}>
        <svg width="130" height="130" className="-rotate-90">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={total === 0 ? circ : offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold text-white">{total === 0 ? '--' : `${rate}%`}</span>
          <span className="text-xs text-gray-400 mt-0.5">{total} 次预测</span>
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-green-400">{correct}</span>
          <span className="text-xs text-gray-500 mt-0.5">✅ 正确</span>
        </div>
        <div className="w-px bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-red-400">{wrong}</span>
          <span className="text-xs text-gray-500 mt-0.5">❌ 错误</span>
        </div>
      </div>
    </div>
  )
}

// ── 当前金价面板 ─────────────────────────────────────────────
function GoldPriceCard({ latest, history }) {
  const prev = history && history.length > 1 ? history[history.length - 2]?.price : null
  const change = prev && latest ? latest.price - prev : null
  const pct = prev ? ((change / prev) * 100).toFixed(2) : null
  const up = change >= 0

  return (
    <div className="card flex flex-col justify-between gap-3 py-6">
      <p className="text-sm text-gray-400 tracking-wide uppercase">当前金价 XAU/USD</p>
      <div>
        <div className="text-5xl font-bold text-yellow-400 tracking-tight">
          {latest ? `$${latest.price.toFixed(2)}` : <span className="text-gray-500 text-3xl">获取中…</span>}
        </div>
        {change !== null && (
          <div className={`mt-2 text-sm font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({up ? '+' : ''}{pct}%) 较上次
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">
        更新于 {latest ? new Date(latest.fetched_at).toLocaleString('zh', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
      </p>
    </div>
  )
}

// ── 历史金价图表 ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f35] border border-yellow-600/30 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-yellow-400 font-bold text-base">${payload[0]?.value?.toFixed(2)}</p>
    </div>
  )
}

function HistoryChart({ history, days, setDays }) {
  const chartData = (history || []).map(h => ({
    time: new Date(h.fetched_at).toLocaleString('zh', {
      month: 'short', day: 'numeric',
      hour: days <= 3 ? '2-digit' : undefined,
      minute: days <= 3 ? '2-digit' : undefined
    }),
    price: h.price
  }))

  const prices = chartData.map(d => d.price).filter(Boolean)
  const minP = prices.length ? Math.min(...prices) * 0.9995 : 0
  const maxP = prices.length ? Math.max(...prices) * 1.0005 : 0
  const avgP = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">📊 历史金价走势</h2>
          {prices.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              均价 <span className="text-yellow-500">${avgP.toFixed(2)}</span>
              &nbsp;·&nbsp;最高 <span className="text-green-400">${Math.max(...prices).toFixed(2)}</span>
              &nbsp;·&nbsp;最低 <span className="text-red-400">${Math.min(...prices).toFixed(2)}</span>
            </p>
          )}
        </div>
        {/* 时间段切换 */}
        <div className="flex gap-1">
          {[1, 3, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                days === d
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {d === 1 ? '今日' : d === 3 ? '3天' : d === 7 ? '7天' : '30天'}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-52 text-gray-500 text-sm">
          暂无数据，点击"刷新"获取
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minP, maxP]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v.toFixed(0)}`}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={avgP} stroke="rgba(251,191,36,0.25)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="price"
              stroke="url(#goldLine)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── 主应用 ───────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null)
  const [latest, setLatest] = useState(null)
  const [history, setHistory] = useState([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadHistory = useCallback(async (d) => {
    try {
      const res = await axios.get(`${BASE}/api/history?days=${d}`)
      if (res.data.success) setHistory(res.data.data)
    } catch (e) { console.error(e) }
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/dashboard`)
      if (res.data.success) {
        const d = res.data.data
        setStats(d.stats)
        setLatest(d.latest)
        setLastUpdate(new Date())
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadDashboard()
    loadHistory(days)
    const t = setInterval(() => { loadDashboard(); loadHistory(days) }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadHistory(days) }, [days])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await axios.post(`${BASE}/api/events/refresh`)
      await axios.post(`${BASE}/api/predictions/auto`)
      await axios.post(`${BASE}/api/predictions/verify`)
      await loadDashboard()
      await loadHistory(days)
    } catch (e) { console.error(e) }
    finally { setRefreshing(false) }
  }

  return (
    <div className="min-h-screen bg-[#070b18]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#070b18]/95 backdrop-blur border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥇</span>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">国际金价预测仪表盘</h1>
              <p className="text-xs text-gray-600">Gold Price Predictor · 事件驱动 AI 分析</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-gray-600 hidden sm:block">
                更新 {lastUpdate.toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-full font-semibold transition-all"
            >
              <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>🔄</span>
              {refreshing ? '更新中…' : '刷新数据'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-3">
              <div className="text-5xl animate-pulse">🥇</div>
              <p className="text-gray-500 text-sm">正在加载数据…</p>
            </div>
          </div>
        ) : (
          <>
            {/* 顶部三栏：准确率 + 正确/错误 | 当前金价 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AccuracyRing
                rate={stats?.accuracy_rate ?? 0}
                total={stats?.total_predictions ?? 0}
                correct={stats?.correct_predictions ?? 0}
              />
              <GoldPriceCard latest={latest} history={history} />
            </div>

            {/* 历史走势图 */}
            <HistoryChart history={history} days={days} setDays={setDays} />
          </>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-700 border-t border-white/5 mt-4">
        数据来源：GoldAPI.io · Reuters · BBC · CNBC · MarketWatch · Kitco &nbsp;|&nbsp; 仅供参考，不构成投资建议
      </footer>
    </div>
  )
}
