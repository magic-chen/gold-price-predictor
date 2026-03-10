export default function EventList({ events }) {
  if (!events?.length) {
    return <div className="text-gray-500 text-sm text-center py-8">暂无事件数据</div>
  }

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
      {events.slice(0, 20).map(evt => (
        <div key={evt.id} className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-yellow-600/30 transition-all">
          <div className="flex items-start gap-2">
            <span className="text-base">📰</span>
            <div className="flex-1 min-w-0">
              {evt.url ? (
                <a
                  href={evt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-200 hover:text-yellow-400 transition-colors line-clamp-2"
                >
                  {evt.title}
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-200 line-clamp-2">{evt.title}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-yellow-600 font-medium">{evt.source}</span>
                <span className="text-xs text-gray-500">
                  {evt.published_at ? new Date(evt.published_at).toLocaleDateString('zh', { month: 'short', day: 'numeric' }) : ''}
                </span>
                {evt.impact_keywords && (
                  <span className="text-xs text-gray-500 truncate max-w-[200px]">
                    🏷 {evt.impact_keywords}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
