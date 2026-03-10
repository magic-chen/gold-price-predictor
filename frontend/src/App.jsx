import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || ''
const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--'
const fmtCNY = (n) => n != null ? `¥${Number(n).toFixed(2)}` : '--'

// ─── 顶部统计卡片 ────────────────────────────────────────────
function MetricCard({ label, value, sub, valueClass = 'text-gray-900', badge, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <div className={`text-3xl font-bold leading-none ${valueClass}`}>{value}</div>
      {(sub || badge) && (
        <div className="flex items-center gap-2 mt-1">
          {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.text}</span>}
          {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ─── 准确率圆弧 ──────────────────────────────────────────────
function AccuracyCard({ rate, total, correct }) {
  const wrong = (total || 0) - (correct || 0)
  const r = 50, circ = 2 * Math.PI * r
  const filled = total > 0 ? (rate / 100) * circ : 0
  const color = rate >= 65 ? '#16a34a' : rate >= 45 ? '#B8860B' : rate === 0 && total === 0 ? '#E5E7EB' : '#dc2626'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">预测准确率</div>
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
          <svg width="110" height="110" className="-rotate-90" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
            <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={circ} strokeDashoffset={total === 0 ? circ : circ - filled}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{total === 0 ? '--' : `${Math.round(rate)}%`}</span>
            <span className="text-xs text-gray-400">{total}次</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div><div className="text-xl font-bold text-green-600">{correct ?? 0}</div><div className="text-xs text-gray-400">预测正确</div></div>
          <div className="h-px bg-gray-100 w-10" />
          <div><div className="text-xl font-bold text-red-500">{wrong}</div><div className="text-xs text-gray-400">预测错误</div></div>
        </div>
      </div>
    </div>
  )
}

// ─── 走势图 ──────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <div className="text-gray-400 text-xs mb-0.5">{label}</div>
      <div className="font-bold text-[#B8860B]">${fmt(payload[0]?.value)}</div>
    </div>
  )
}

const TABS = [{ v: 7, l: '7天' }, { v: 14, l: '14天' }, { v: 30, l: '30天' }]

function PriceChart({ history, days, setDays }) {
  const data = (history || []).map(h => ({
    t: new Date(h.fetched_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    price: h.price
  }))
  const prices = data.map(d => d.price).filter(Boolean)
  const minP = prices.length ? Math.min(...prices) * 0.998 : 0
  const maxP = prices.length ? Math.max(...prices) * 1.002 : 0
  const avgP = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  const first = prices[0], last = prices[prices.length - 1]
  const trend = last && first ? last - first : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">国际金价走势 XAU/USD</div>
          {prices.length > 0 && (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-gray-500">均价 <b className="text-gray-700">${fmt(avgP)}</b></span>
              <span className="text-green-600">最高 <b>${fmt(Math.max(...prices))}</b></span>
              <span className="text-red-500">最低 <b>${fmt(Math.min(...prices))}</b></span>
              {trend !== 0 && <span className={trend > 0 ? 'text-green-600' : 'text-red-500'}>{trend > 0 ? '▲' : '▼'} ${fmt(Math.abs(trend))} 区间变动</span>}
            </div>
          )}
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(({ v, l }) => (
            <button key={v} onClick={() => setDays(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${days === v ? 'bg-white text-[#B8860B] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-300 text-sm">暂无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B8860B" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#B8860B" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[minP, maxP]} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={52} />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={avgP} stroke="#B8860B" strokeDasharray="4 3" strokeOpacity={0.25} />
            <Area type="monotone" dataKey="price" stroke="#B8860B" strokeWidth={2.5} fill="url(#goldGrad)" dot={false} activeDot={{ r: 5, fill: '#B8860B', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── 事件卡片 ────────────────────────────────────────────────
const SENTIMENT = {
  bullish: { label: '利好金价', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', icon: '↑' },
  bearish: { label: '利空金价', bg: 'bg-blue-50',  border: 'border-blue-100',  dot: 'bg-blue-400',  text: 'text-blue-700',  icon: '↓' },
  neutral: { label: '影响中性', bg: 'bg-gray-50',  border: 'border-gray-100',  dot: 'bg-gray-300',  text: 'text-gray-500',  icon: '—' },
}

function EventCard({ evt }) {
  const s = SENTIMENT[evt.sentiment] || SENTIMENT.neutral
  const dateStr = evt.published_at ? new Date(evt.published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''
  const tags = (evt.impact_keywords || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3)
  const hasVerified = !!evt.verified_result

  return (
    <a href={evt.url || '#'} target="_blank" rel="noopener noreferrer"
      className={`block rounded-xl border ${s.border} ${s.bg} p-4 hover:shadow-md transition-all group`}>
      {/* 情绪标签行 */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white border ${s.border} ${s.text}`}>
          <span>{s.icon}</span> {s.label}
        </span>
        <span className="text-xs text-gray-400">{evt.source}</span>
        <span className="text-xs text-gray-300 ml-auto">{dateStr}</span>
      </div>

      {/* 标题（中文优先，后跟英文） */}
      <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-[#B8860B] transition-colors line-clamp-2 mb-1">
        {evt.title_zh && evt.title_zh !== evt.title ? evt.title_zh : evt.title}
      </p>
      {evt.title_zh && evt.title_zh !== evt.title && (
        <p className="text-xs text-gray-400 line-clamp-1 mb-2 italic">{evt.title}</p>
      )}

      {/* 判断依据 */}
      {evt.sentiment_reason && (
        <p className="text-xs text-gray-500 bg-white/60 rounded-lg px-3 py-1.5 mt-2 border border-white">
          <span className="font-medium text-gray-600">判断依据：</span>{evt.sentiment_reason}
        </p>
      )}

      {/* 回测结果 */}
      {hasVerified && (
        <div className={`mt-2 text-xs font-semibold px-3 py-1 rounded-lg inline-block ${
          evt.verified_result === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {evt.verified_result === 'correct' ? '✓ 回测验证：预测正确' : '✗ 回测验证：预测错误'}
        </div>
      )}

      {/* 关键词标签 */}
      {tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {tags.map(t => <span key={t} className="text-xs bg-white text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">{t}</span>)}
        </div>
      )}
    </a>
  )
}

// ─── 主 App ──────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null)
  const [latest, setLatest] = useState(null)
  const [history, setHistory] = useState([])
  const [events, setEvents] = useState([])
  const [cnyPerGram, setCnyPerGram] = useState(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadHistory = useCallback(async (d) => {
    try {
      const res = await axios.get(`${BASE}/api/history?days=${d}`)
      if (res.data.success) setHistory(res.data.data)
    } catch (e) {}
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/dashboard`)
      if (res.data.success) {
        const d = res.data.data
        setStats(d.stats)
        setLatest(d.latest)
        setEvents(d.events || [])
        setCnyPerGram(d.cnyPerGram)
        setLastUpdate(new Date())
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadAll()
    loadHistory(days)
    const t = setInterval(() => { loadAll(); loadHistory(days) }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadHistory(days) }, [days])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await axios.post(`${BASE}/api/events/refresh`)
      await axios.post(`${BASE}/api/predictions/verify`)
      await loadAll()
      await loadHistory(days)
    } catch (e) {}
    finally { setRefreshing(false) }
  }

  const prices = history.map(h => h.price).filter(Boolean)
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : null
  const curPrice = latest?.price
  const priceChange = curPrice && prevPrice ? curPrice - prevPrice : null
  const priceChangePct = prevPrice && priceChange ? ((priceChange / prevPrice) * 100).toFixed(2) : null
  const priceUp = (priceChange ?? 0) >= 0

  // 事件分组
  const bullishCount = events.filter(e => e.sentiment === 'bullish').length
  const bearishCount = events.filter(e => e.sentiment === 'bearish').length

  return (
    <div className="min-h-screen bg-[#F8F9FC]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#B8860B] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">国际金价预测仪表盘</h1>
              <p className="text-xs text-gray-400">Gold Price Predictor · 事件驱动分析</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <span className="text-xs text-gray-400 hidden sm:block">更新 {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={handleRefresh} disabled={refreshing}
              className="inline-flex items-center gap-1.5 bg-[#B8860B] hover:bg-[#9a7009] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all">
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? '更新中' : '刷新数据'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-9 h-9 border-4 border-[#B8860B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">正在加载数据…</p>
          </div>
        ) : (
          <>
            {/* ── 顶部卡片 3列 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* 国际金价 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">国际金价 XAU/USD</div>
                <div className="text-4xl font-bold text-gray-900 leading-none">
                  {curPrice ? `$${fmt(curPrice)}` : <span className="text-gray-300 text-2xl">获取中…</span>}
                </div>
                {priceChange !== null && (
                  <div className={`mt-2 text-sm font-semibold ${priceUp ? 'text-green-600' : 'text-red-500'}`}>
                    {priceUp ? '▲' : '▼'} ${fmt(Math.abs(priceChange))}（{priceUp ? '+' : ''}{priceChangePct}%）
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {latest?.fetched_at ? new Date(latest.fetched_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                </div>
              </div>

              {/* 国内金价（人民币/克） */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">国内金价（参考）</div>
                <div className="text-4xl font-bold text-[#B8860B] leading-none">
                  {cnyPerGram ? `¥${cnyPerGram.toFixed(2)}` : <span className="text-gray-300 text-2xl">计算中…</span>}
                </div>
                <div className="mt-2 text-sm text-gray-500">每克 · 人民币</div>
                <div className="text-xs text-gray-400 mt-2">
                  基于实时汇率换算，仅供参考
                </div>
              </div>

              {/* 预测准确率 */}
              <AccuracyCard
                rate={stats?.accuracy_rate ?? 0}
                total={stats?.total_predictions ?? 0}
                correct={stats?.correct_predictions ?? 0}
              />
            </div>

            {/* ── 走势图 ── */}
            <PriceChart history={history} days={days} setDays={setDays} />

            {/* ── 事件列表 ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">近期影响金价事件</div>
                  <div className="flex gap-3 text-sm text-gray-500">
                    <span>共 {events.length} 条</span>
                    <span className="text-amber-600">↑ 利好 {bullishCount}</span>
                    <span className="text-blue-600">↓ 利空 {bearishCount}</span>
                    <span className="text-gray-400">— 中性 {events.length - bullishCount - bearishCount}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">点击事件查看原文</div>
              </div>

              {events.length === 0 ? (
                <div className="text-center py-12 text-gray-300 text-sm">暂无事件，点击刷新获取</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map(evt => <EventCard key={evt.id} evt={evt} />)}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-300 border-t border-gray-100 mt-4">
        数据来源：api.gold-api.com · GoldAPI.io · WSJ · CNBC · ForexLive &nbsp;|&nbsp; 仅供参考，不构成投资建议
      </footer>
    </div>
  )
}
