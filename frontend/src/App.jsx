import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Area, AreaChart
} from 'recharts'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || ''

// ─── 工具函数 ────────────────────────────────────────────────
const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--'
const fmtDate = (s, opts) => s ? new Date(s).toLocaleDateString('zh-CN', opts) : '--'
const fmtTime = (s) => s ? new Date(s).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'

// ─── 配色系统 ────────────────────────────────────────────────
// 主色：深金 #B8860B  辅色：石板蓝 #4A6FA5  底色：纯白 #FFFFFF
// 文字：深灰 #1A1A2E  次文字：#6B7280  边框：#E5E7EB  背景块：#F8F9FC

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-3xl font-bold mt-1 ${accent || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── 准确率圆弧 ──────────────────────────────────────────────
function AccuracyArc({ rate, total, correct }) {
  const wrong = (total || 0) - (correct || 0)
  const r = 56, circ = 2 * Math.PI * r
  const filled = total > 0 ? (rate / 100) * circ : 0
  const color = rate >= 65 ? '#16a34a' : rate >= 45 ? '#B8860B' : '#dc2626'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">预测准确率</div>
      <div className="flex items-center gap-6">
        {/* 圆弧 */}
        <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" className="-rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={r} fill="none" stroke="#F3F4F6" strokeWidth="12" />
            <circle
              cx="64" cy="64" r={r} fill="none"
              stroke={color} strokeWidth="12"
              strokeDasharray={circ}
              strokeDashoffset={total === 0 ? circ : circ - filled}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{total === 0 ? '--' : `${Math.round(rate)}%`}</span>
            <span className="text-xs text-gray-400">{total} 次</span>
          </div>
        </div>
        {/* 明细 */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xl font-bold text-green-600">{correct ?? 0}</div>
            <div className="text-xs text-gray-400">预测正确</div>
          </div>
          <div className="h-px bg-gray-100 w-12" />
          <div>
            <div className="text-xl font-bold text-red-500">{wrong}</div>
            <div className="text-xs text-gray-400">预测错误</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 金价走势图 ──────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-[#B8860B] font-bold text-base">${fmt(payload[0]?.value)}</div>
    </div>
  )
}

function PriceChart({ history, days, setDays }) {
  const data = (history || []).map(h => ({
    t: new Date(h.fetched_at).toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric',
      ...(days <= 3 ? { hour: '2-digit', minute: '2-digit' } : {})
    }),
    price: h.price
  }))

  const prices = data.map(d => d.price).filter(Boolean)
  const minP = prices.length ? Math.min(...prices) * 0.9992 : 0
  const maxP = prices.length ? Math.max(...prices) * 1.0008 : 0
  const avgP = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  const first = prices[0], last = prices[prices.length - 1]
  const trend = last && first ? last - first : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">历史金价走势 XAU/USD</div>
          {prices.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">均价 <span className="font-semibold text-gray-700">${fmt(avgP)}</span></span>
              <span className="text-green-600">最高 <span className="font-semibold">${fmt(Math.max(...prices))}</span></span>
              <span className="text-red-500">最低 <span className="font-semibold">${fmt(Math.min(...prices))}</span></span>
              {trend !== 0 && (
                <span className={trend > 0 ? 'text-green-600' : 'text-red-500'}>
                  {trend > 0 ? '▲' : '▼'} ${fmt(Math.abs(trend))}
                </span>
              )}
            </div>
          )}
        </div>
        {/* 时间切换 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[{ v: 1, l: '今日' }, { v: 3, l: '3天' }, { v: 7, l: '7天' }, { v: 30, l: '30天' }].map(({ v, l }) => (
            <button key={v} onClick={() => setDays(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${days === v ? 'bg-white text-[#B8860B] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 图表 */}
      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-300 text-sm">暂无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B8860B" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#B8860B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[minP, maxP]} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={68} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={avgP} stroke="#B8860B" strokeDasharray="4 4" strokeOpacity={0.3} />
            <Area type="monotone" dataKey="price" stroke="#B8860B" strokeWidth={2.5} fill="url(#goldGrad)" dot={false} activeDot={{ r: 5, fill: '#B8860B', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── 事件列表 ────────────────────────────────────────────────
const IMPACT_COLORS = {
  high: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', label: '高影响', text: 'text-amber-700' },
  med:  { bg: 'bg-blue-50',  border: 'border-blue-100',  dot: 'bg-blue-400',  label: '中影响', text: 'text-blue-700' },
  low:  { bg: 'bg-gray-50',  border: 'border-gray-100',  dot: 'bg-gray-300',  label: '低影响', text: 'text-gray-500' },
}

const HIGH_KEYWORDS = ['war', 'invasion', 'crisis', 'inflation', 'sanctions', 'rate cut', 'rate hike', 'federal reserve', 'fed', 'default', 'central bank']

function eventImpact(evt) {
  const kw = (evt.impact_keywords || '').toLowerCase()
  const count = (evt.impact_keywords || '').split(',').filter(Boolean).length
  const isHigh = HIGH_KEYWORDS.some(k => kw.includes(k))
  return isHigh || count >= 3 ? 'high' : count >= 2 ? 'med' : 'low'
}

function EventCard({ evt }) {
  const impact = eventImpact(evt)
  const c = IMPACT_COLORS[impact]
  const tags = (evt.impact_keywords || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)

  return (
    <a href={evt.url || '#'} target="_blank" rel="noopener noreferrer"
      className={`block rounded-xl border ${c.border} ${c.bg} p-4 hover:shadow-md transition-all group`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${c.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-[#B8860B] transition-colors line-clamp-2">
            {evt.title}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white border ${c.border} ${c.text}`}>{c.label}</span>
            <span className="text-xs text-gray-400">{evt.source}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">{fmtDate(evt.published_at, { month: 'short', day: 'numeric' })}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {tags.map(t => (
                <span key={t} className="text-xs bg-white text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}

// ─── 主应用 ──────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(null)
  const [latest, setLatest] = useState(null)
  const [history, setHistory] = useState([])
  const [events, setEvents] = useState([])
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

  const loadAll = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/dashboard`)
      if (res.data.success) {
        const d = res.data.data
        setStats(d.stats)
        setLatest(d.latest)
        setEvents(d.events || [])
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
      await axios.post(`${BASE}/api/predictions/auto`)
      await axios.post(`${BASE}/api/predictions/verify`)
      await loadAll()
      await loadHistory(days)
    } catch (e) { console.error(e) }
    finally { setRefreshing(false) }
  }

  // 价格涨跌
  const prices = history.map(h => h.price).filter(Boolean)
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : null
  const curPrice = latest?.price
  const priceChange = curPrice && prevPrice ? curPrice - prevPrice : null
  const priceChangePct = prevPrice && priceChange ? ((priceChange / prevPrice) * 100).toFixed(2) : null
  const priceUp = priceChange >= 0

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#B8860B] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">国际金价预测</h1>
              <p className="text-xs text-gray-400">Gold Price Predictor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-400 hidden sm:block">
                更新于 {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="inline-flex items-center gap-2 bg-[#B8860B] hover:bg-[#9a7009] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all">
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
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-[#B8860B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">正在加载数据…</p>
          </div>
        ) : (
          <>
            {/* ── 顶部数据卡片 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 当前金价 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 sm:col-span-2 lg:col-span-1">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">当前金价 XAU/USD</div>
                <div className="text-4xl font-bold text-gray-900 tracking-tight">
                  {curPrice ? `$${fmt(curPrice)}` : <span className="text-gray-300 text-2xl">获取中…</span>}
                </div>
                {priceChange !== null && (
                  <div className={`mt-2 text-sm font-semibold ${priceUp ? 'text-green-600' : 'text-red-500'}`}>
                    {priceUp ? '▲' : '▼'} ${fmt(Math.abs(priceChange))} ({priceUp ? '+' : ''}{priceChangePct}%)
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">{fmtTime(latest?.fetched_at)}</div>
              </div>

              {/* 准确率 */}
              <AccuracyArc
                rate={stats?.accuracy_rate ?? 0}
                total={stats?.total_predictions ?? 0}
                correct={stats?.correct_predictions ?? 0}
              />

              {/* 正确次数 */}
              <StatCard
                label="预测正确"
                value={stats?.correct_predictions ?? 0}
                sub={`共 ${stats?.total_predictions ?? 0} 次预测`}
                accent="text-green-600"
                icon={<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
              />

              {/* 错误次数 */}
              <StatCard
                label="预测错误"
                value={(stats?.total_predictions ?? 0) - (stats?.correct_predictions ?? 0)}
                sub="24h后自动验证"
                accent="text-red-500"
                icon={<svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
              />
            </div>

            {/* ── 历史走势图 ── */}
            <PriceChart history={history} days={days} setDays={setDays} />

            {/* ── 近期影响事件 ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">近期影响金价事件</div>
                  <div className="text-sm text-gray-500">共 {events.length} 条 · 按相关度排序</div>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />高影响</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />中影响</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />低影响</span>
                </div>
              </div>
              {events.length === 0 ? (
                <div className="text-center py-10 text-gray-300 text-sm">暂无事件，点击刷新获取</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map(evt => <EventCard key={evt.id} evt={evt} />)}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-300 border-t border-gray-100 mt-6">
        数据来源：GoldAPI.io · Reuters · BBC · CNBC · MarketWatch · Kitco &nbsp;|&nbsp; 仅供参考，不构成投资建议
      </footer>
    </div>
  )
}
