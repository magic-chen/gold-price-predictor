import { useDashboard } from './hooks/useDashboard'
import GoldChart from './components/GoldChart'
import PredictionList from './components/PredictionList'
import EventList from './components/EventList'

function AccuracyRing({ rate }) {
  const radius = 40
  const circ = 2 * Math.PI * radius
  const offset = circ - (rate / 100) * circ
  const color = rate >= 60 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-white">{rate}%</span>
        <span className="text-xs text-gray-400">准确率</span>
      </div>
    </div>
  )
}

export default function App() {
  const { data, loading, error, refresh, refreshing } = useDashboard()

  const stats = data?.stats || {}
  const latest = data?.latest
  const history = data?.history || []
  const events = data?.events || []
  const predictions = data?.predictions || []

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-10 bg-[#0a0e1a]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥇</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">国际金价预测</h1>
              <p className="text-xs text-gray-500">Gold Price Predictor · 事件驱动分析</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {latest && (
              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-400">
                  ${latest.price?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  XAU/USD · {latest.fetched_at ? new Date(latest.fetched_at).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </div>
              </div>
            )}

            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-all"
            >
              <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
              {refreshing ? '更新中...' : '刷新预测'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🥇</div>
              <p className="text-gray-400">正在加载数据...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="card border-red-500/30 bg-red-900/10 text-red-400 text-sm">
            ⚠️ {error} — 请检查后端服务是否运行
          </div>
        )}

        {!loading && data && (
          <>
            {/* 第一行：统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card flex flex-col items-center justify-center gap-1 text-center">
                <AccuracyRing rate={stats.accuracy_rate || 0} />
                <p className="text-xs text-gray-400 mt-1">累计预测准确率</p>
              </div>

              <div className="card flex flex-col justify-between">
                <p className="text-sm text-gray-400 mb-2">预测总次数</p>
                <p className="text-3xl font-bold text-white">{stats.total_predictions || 0}</p>
                <p className="text-xs text-green-400 mt-1">✓ 正确 {stats.correct_predictions || 0} 次</p>
              </div>

              <div className="card flex flex-col justify-between">
                <p className="text-sm text-gray-400 mb-2">近期事件</p>
                <p className="text-3xl font-bold text-white">{events.length}</p>
                <p className="text-xs text-gray-500 mt-1">最近 7 天</p>
              </div>

              <div className="card flex flex-col justify-between">
                <p className="text-sm text-gray-400 mb-2">待验证预测</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {predictions.filter(p => p.is_correct === null || p.is_correct === undefined).length}
                </p>
                <p className="text-xs text-gray-500 mt-1">24h后自动核对</p>
              </div>
            </div>

            {/* 第二行：金价走势 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">📊 金价走势（近7天）</h2>
                {latest && (
                  <span className="text-xs text-gray-400">
                    最新: ${latest.price?.toFixed(2)} · {latest.fetched_at ? new Date(latest.fetched_at).toLocaleString('zh') : ''}
                  </span>
                )}
              </div>
              <GoldChart history={history} />
            </div>

            {/* 第三行：预测 + 事件 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">🎯 预测记录</h2>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>✅ 正确</span>
                    <span>❌ 错误</span>
                    <span>⏳ 待验证</span>
                  </div>
                </div>
                <PredictionList predictions={predictions} />
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">📰 近期影响事件</h2>
                  <span className="text-xs text-gray-500">按金价相关度排序</span>
                </div>
                <EventList events={events} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* 底部 */}
      <footer className="text-center py-8 text-xs text-gray-600 border-t border-white/5">
        Gold Price Predictor · 数据仅供参考，不构成投资建议 · GoldAPI.io
      </footer>
    </div>
  )
}
