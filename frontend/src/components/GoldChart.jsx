import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-yellow-600/30 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-yellow-400 font-bold">${payload[0]?.value?.toFixed(2)}</p>
    </div>
  )
}

export default function GoldChart({ history }) {
  const chartData = (history || []).map(h => ({
    time: new Date(h.fetched_at).toLocaleDateString('zh', { month: 'short', day: 'numeric', hour: '2-digit' }),
    price: h.price
  }))

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        暂无价格历史数据
      </div>
    )
  }

  const minPrice = Math.min(...chartData.map(d => d.price)) * 0.999
  const maxPrice = Math.max(...chartData.map(d => d.price)) * 1.001

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="time"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice, maxPrice]}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `$${v.toFixed(0)}`}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#f59e0b' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
