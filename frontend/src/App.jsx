import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import axios from 'axios'
import { useDashboard } from './hooks/useDashboard'

const BASE = import.meta.env.VITE_API_BASE || ''
const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '--'

// ─── 多窗口预测卡片 ──────────────────────────────────────────
const DIR_STYLE = {
  up:      { label: '看涨', icon: '↑', bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', bar: 'bg-green-500' },
  down:    { label: '看跌', icon: '↓', bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-600',   bar: 'bg-red-500'   },
  neutral: { label: '震荡', icon: '—', bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-500',  bar: 'bg-gray-300'  },
}

const RESULT_STYLE = {
  correct: { label: '✓ 正确', cls: 'bg-green-600 text-white' },
  wrong:   { label: '✗ 错误', cls: 'bg-red-500 text-white'   },
  neutral: { label: '— 中性', cls: 'bg-gray-200 text-gray-500' },
}

function HorizonBadge({ horizon, direction, confidence, result, threshold }) {
  const s = DIR_STYLE[direction] || DIR_STYLE.neutral
  const confPct = confidence != null ? Math.round(confidence * 100) : 0

  return (
    <div className={`flex-1 rounded-xl border ${s.border} ${s.bg} p-3 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">{horizon}</span>
        {result && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${RESULT_STYLE[result]?.cls}`}>{RESULT_STYLE[result]?.label}</span>}
      </div>
      <div className={`text-xl font-bold ${s.text}`}>{s.icon} {s.label}</div>
      {/* 置信度条 */}
      <div className="w-full h-1 bg-white rounded-full overflow-hidden">
        <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${confPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>置信 {confPct}%</span>
        <span>阈值 {threshold}%</span>
      </div>
    </div>
  )
}

function PredictionCard({ prediction, accuracy, thresholds }) {
  if (!prediction) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-full">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">方向预测</div>
      <div className="text-sm text-gray-300 text-center py-4">预测生成中…</div>
    </div>
  )

  const ts = prediction.decision_time
    ? new Date(prediction.decision_time + 'Z').toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '--'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">方向预测</div>
          <div className="text-xs text-gray-400 mt-0.5">决策时刻 {ts} · 基于24h事件+价格动量</div>
        </div>
        <div className="text-xs text-gray-400 text-right">
          <span>↑{prediction.bullish_count}</span>
          <span className="mx-1">↓{prediction.bearish_count}</span>
          <span>—{prediction.neutral_count}</span>
          <div>{prediction.price_change_24h != null ? `${prediction.price_change_24h > 0 ? '+' : ''}${prediction.price_change_24h}%` : ''} 24h</div>
        </div>
      </div>

      <div className="flex gap-2">
        <HorizonBadge horizon="4h"  direction={prediction.direction_4h}  confidence={prediction.confidence_4h}  result={prediction.result_4h}  threshold={thresholds?.['4h']  ?? 0.25} />
        <HorizonBadge horizon="24h" direction={prediction.direction_24h} confidence={prediction.confidence_24h} result={prediction.result_24h} threshold={thresholds?.['24h'] ?? 0.50} />
        <HorizonBadge horizon="72h" direction={prediction.direction_72h} confidence={prediction.confidence_72h} result={prediction.result_72h} threshold={thresholds?.['72h'] ?? 1.00} />
      </div>
    </div>
  )
}

// ─── 准确率卡片（v2，三窗口）────────────────────────────────
function AccuracyV2Card({ accuracy }) {
  const horizons = ['4h', '24h', '72h']
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">预测准确率</div>
      <div className="flex gap-3">
        {horizons.map(h => {
          const a = (accuracy || []).find(x => x.horizon === h)
          const rate = a?.rate ?? 0
          const total = a?.total ?? 0
          const correct = a?.correct ?? 0
          const color = rate >= 65 ? 'text-green-600' : rate >= 45 ? 'text-amber-600' : total === 0 ? 'text-gray-300' : 'text-red-500'
          const barColor = rate >= 65 ? 'bg-green-500' : rate >= 45 ? 'bg-amber-400' : 'bg-gray-200'
          return (
            <div key={h} className="flex-1 text-center">
              <div className="text-xs text-gray-400 mb-1">{h}</div>
              <div className={`text-2xl font-bold ${color}`}>{total === 0 ? '--' : `${Math.round(rate)}%`}</div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${rate}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1">{correct}/{total}</div>
            </div>
          )
        })}
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

// ─── 每日标题栏 ──────────────────────────────────────────────
function DayHeader({ dateStr, events }) {
  const bullish = events.filter(e => e.sentiment === 'bullish').length
  const bearish = events.filter(e => e.sentiment === 'bearish').length
  const total = events.length

  // 当天整体预测倾向
  let overall, overallColor, overallBg, overallIcon
  if (bullish > bearish) {
    overall = '整体利好'; overallColor = 'text-green-700'; overallBg = 'bg-green-100'; overallIcon = '↑'
  } else if (bearish > bullish) {
    overall = '整体利空'; overallColor = 'text-red-600'; overallBg = 'bg-red-100'; overallIcon = '↓'
  } else {
    overall = '信号混合'; overallColor = 'text-gray-500'; overallBg = 'bg-gray-100'; overallIcon = '—'
  }

  // 找是否有回测过的事件
  const verified = events.filter(e => e.verified_result)
  const correctCount = verified.filter(e => e.verified_result === 'correct').length
  const hasVerified = verified.length > 0

  return (
    <div className="flex items-center gap-3 mt-6 mb-3 first:mt-0">
      {/* 日期 */}
      <div className="flex-shrink-0 text-sm font-bold text-gray-700 w-16">{dateStr}</div>

      {/* 分割线 */}
      <div className="flex-1 h-px bg-gray-200" />

      {/* 当日预测标签 */}
      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${overallBg} ${overallColor}`}>
        {overallIcon} {overall} · {total}条
      </span>

      {/* 回测结果（有的话） */}
      {hasVerified && (
        <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
          correctCount === verified.length ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
        }`}>
          回测 {correctCount}/{verified.length} 正确
        </span>
      )}
    </div>
  )
}
const SENTIMENT = {
  bullish: {
    label: '利好金价', icon: '↑',
    cardBg: 'bg-green-50', cardBorder: 'border-green-200',
    tagBg: 'bg-green-100', tagText: 'text-green-700',
    dot: 'bg-green-400',
  },
  bearish: {
    label: '利空金价', icon: '↓',
    cardBg: 'bg-red-50', cardBorder: 'border-red-200',
    tagBg: 'bg-red-100', tagText: 'text-red-700',
    dot: 'bg-red-400',
  },
  neutral: {
    label: '影响中性', icon: '—',
    cardBg: 'bg-gray-50', cardBorder: 'border-gray-200',
    tagBg: 'bg-gray-100', tagText: 'text-gray-500',
    dot: 'bg-gray-300',
  },
}

function EventCard({ evt }) {
  const s = SENTIMENT[evt.sentiment] || SENTIMENT.neutral
  const dateStr = evt.published_at
    ? new Date(evt.published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    : ''
  const tags = (evt.impact_keywords || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3)
  const hasVerified = !!evt.verified_result
  const isCorrect = evt.verified_result === 'correct'

  return (
    <a href={evt.url || '#'} target="_blank" rel="noopener noreferrer"
      className={`block rounded-xl border ${s.cardBorder} ${s.cardBg} overflow-hidden hover:shadow-md transition-all group`}>

      {/* 回测验证结果标题区（仅在有验证结果时显示） */}
      {hasVerified && (
        <div className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b ${
          isCorrect
            ? 'bg-green-600 text-white border-green-700'
            : 'bg-red-500 text-white border-red-600'
        }`}>
          <span>{isCorrect ? '✓' : '✗'}</span>
          <span>回测验证</span>
          <span className="font-normal opacity-90">{isCorrect ? '预测正确' : '预测错误'}</span>
        </div>
      )}

      {/* 卡片主体 */}
      <div className="p-4">
        {/* 顶部：情绪标签 + 来源 + 日期 */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.tagBg} ${s.tagText}`}>
            {s.icon} {s.label}
          </span>
          <span className="text-xs text-gray-400">{evt.source}</span>
          <span className="text-xs text-gray-300 ml-auto flex-shrink-0">{dateStr}</span>
        </div>

        {/* 新闻标题（英文原文） */}
        <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-[#B8860B] transition-colors line-clamp-2 mb-2">
          {evt.title}
        </p>

        {/* 判断依据 */}
        {evt.sentiment_reason && evt.sentiment !== 'neutral' && (
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-medium text-gray-600">依据：</span>{evt.sentiment_reason}
          </p>
        )}

        {/* 关键词标签 */}
        {tags.length > 0 && (
          <div className="flex gap-1 mt-2.5 flex-wrap">
            {tags.map(t => (
              <span key={t} className="text-xs bg-white/70 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  )
}

// ─── 主 App ──────────────────────────────────────────────────
export default function App() {
  const { data, loading, error, refresh, refreshing, livePrice, newEventCount } = useDashboard()
  const [history, setHistory] = useState([])
  const [days, setDays] = useState(7)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [predV2, setPredV2] = useState(null)
  const [accuracyV2, setAccuracyV2] = useState([])
  const [thresholds, setThresholds] = useState({})

  const loadHistory = useCallback(async (d) => {
    try {
      const res = await axios.get(`${BASE}/api/history?days=${d}`)
      if (res.data.success) setHistory(res.data.data)
    } catch (e) {}
  }, [])

  const loadPredV2 = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/predictions/v2/latest`)
      if (res.data.success) {
        setPredV2(res.data.data.latest)
        setAccuracyV2(res.data.data.accuracy)
        setThresholds(res.data.data.thresholds || {})
      }
    } catch (e) {}
  }, [])

  useEffect(() => { loadHistory(days) }, [days])

  useEffect(() => {
    if (data) {
      setLastUpdate(new Date())
      loadPredV2()
    }
  }, [data])

  const stats = data?.stats
  const latest = data?.latest
  const events = data?.events || []
  const cnyPerGram = data?.cnyPerGram

  // livePrice 优先（SSE实时更新），否则用 latest
  const curPrice = livePrice || latest?.price
  const prices = history.map(h => h.price).filter(Boolean)
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : null
  const priceChange = curPrice && prevPrice ? curPrice - prevPrice : null
  const priceChangePct = prevPrice && priceChange ? ((priceChange / prevPrice) * 100).toFixed(2) : null
  const priceUp = (priceChange ?? 0) >= 0

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
              <h1 className="text-sm font-bold text-gray-900">金价预测</h1>
              <p className="text-xs text-gray-400">Gold Price Predictor · 事件驱动分析</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 实时状态 */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="hidden sm:inline">实时更新</span>
            </div>
            {/* 有新事件时提示 */}
            {newEventCount > 0 && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium animate-pulse">
                {newEventCount} 条新事件
              </span>
            )}
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
            {/* ── 顶部卡片：金价 + 国内金价 + 准确率 ── */}
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
                <div className="text-xs text-gray-400 mt-2">XAU/USD · 每30分钟更新</div>
              </div>

              {/* 国内金价（人民币/克） */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">国内金价（参考）</div>
                <div className="text-4xl font-bold text-[#B8860B] leading-none">
                  {cnyPerGram ? `¥${cnyPerGram.toFixed(2)}` : <span className="text-gray-300 text-2xl">计算中…</span>}
                </div>
                <div className="mt-2 text-sm text-gray-500">每克 · 人民币</div>
                <div className="text-xs text-gray-400 mt-2">基于实时汇率换算，仅供参考</div>
              </div>

              {/* 三窗口准确率 */}
              <AccuracyV2Card accuracy={accuracyV2} />
            </div>

            {/* ── 当前预测卡片 ── */}
            <PredictionCard prediction={predV2} accuracy={accuracyV2} thresholds={thresholds} />

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
              ) : (() => {
                // 按日期分组
                const groups = {}
                events.forEach(evt => {
                  const day = evt.published_at
                    ? new Date(evt.published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
                    : '未知日期'
                  if (!groups[day]) groups[day] = []
                  groups[day].push(evt)
                })
                // 按日期降序排列
                const sortedDays = Object.keys(groups).sort((a, b) => {
                  const da = new Date(groups[a][0].published_at)
                  const db = new Date(groups[b][0].published_at)
                  return db - da
                })
                return sortedDays.map(day => (
                  <div key={day}>
                    <DayHeader dateStr={day} events={groups[day]} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groups[day].map(evt => <EventCard key={evt.id} evt={evt} />)}
                    </div>
                  </div>
                ))
              })()}
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
