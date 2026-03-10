const DIRECTION_MAP = {
  up: { label: '📈 看涨', cls: 'badge-up', icon: '↑' },
  down: { label: '📉 看跌', cls: 'badge-down', icon: '↓' },
  neutral: { label: '➡️ 震荡', cls: 'badge-neutral', icon: '—' }
}

export default function PredictionList({ predictions }) {
  if (!predictions?.length) {
    return <div className="text-gray-500 text-sm text-center py-8">暂无预测记录</div>
  }

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {predictions.map(pred => {
        const dir = DIRECTION_MAP[pred.prediction] || DIRECTION_MAP.neutral
        const verified = pred.is_correct !== null && pred.is_correct !== undefined
        const correct = pred.is_correct === 1

        return (
          <div
            key={pred.id}
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-yellow-600/40 transition-all"
          >
            {/* 事件标题 */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">{verified ? (correct ? '✅' : '❌') : '⏳'}</span>
              <div className="flex-1 min-w-0">
                {pred.event_url ? (
                  <a
                    href={pred.event_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-200 hover:text-yellow-400 transition-colors line-clamp-2"
                  >
                    {pred.event_title || '未知事件'}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-gray-200 line-clamp-2">
                    {pred.event_title || '未知事件'}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {pred.event_source} · {pred.event_published_at ? new Date(pred.event_published_at).toLocaleDateString('zh') : ''}
                </p>
              </div>
            </div>

            {/* 预测信息 */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={dir.cls}>预测 {dir.label}</span>
              <span className="text-xs text-gray-400">置信度 {pred.confidence}%</span>

              {pred.gold_price_at_prediction && (
                <span className="text-xs text-gray-400">
                  预测时 ${pred.gold_price_at_prediction?.toFixed(2)}
                </span>
              )}
              {pred.gold_price_verified && (
                <span className="text-xs text-gray-400">
                  → 验证时 ${pred.gold_price_verified?.toFixed(2)}
                </span>
              )}
            </div>

            {/* 分析理由 */}
            {pred.reasoning && (
              <p className="text-xs text-gray-400 mt-2 border-t border-white/5 pt-2 leading-relaxed">
                {pred.reasoning}
              </p>
            )}

            {/* 验证结果 */}
            {verified && (
              <div className={`mt-2 text-xs font-semibold ${correct ? 'text-green-400' : 'text-red-400'}`}>
                {correct ? '✓ 预测正确' : '✗ 预测错误'}
                {pred.verified_at && ` · 验证于 ${new Date(pred.verified_at).toLocaleDateString('zh')}`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
