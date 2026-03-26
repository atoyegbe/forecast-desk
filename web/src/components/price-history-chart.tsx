import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatChartTick,
  formatProbability,
} from '../lib/format'
import type { PulsePricePoint } from '../features/events/types'

type PriceHistoryChartProps = {
  points: PulsePricePoint[]
}

export function PriceHistoryChart({ points }: PriceHistoryChartProps) {
  if (!points.length) {
    return (
      <div className="panel flex h-80 items-center justify-center p-6 text-center text-stone-500">
        Price history is not available for this market yet.
      </div>
    )
  }

  const chartData = points.map((point) => ({
    label: formatChartTick(point.timestamp),
    price: Number((point.price * 100).toFixed(2)),
    timestamp: point.timestamp,
  }))
  const prices = chartData.map((point) => point.price)
  const min = Math.max(0, Math.floor(Math.min(...prices) - 3))
  const max = Math.min(100, Math.ceil(Math.max(...prices) + 3))

  return (
    <div className="panel h-80 p-4 sm:p-6">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 10 }}>
          <defs>
            <linearGradient id="price-wave" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f4efe7" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(28,25,23,0.08)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={42}
            tick={{ fill: 'rgba(87,83,78,0.8)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[min, max]}
            tick={{ fill: 'rgba(87,83,78,0.8)', fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(251, 248, 242, 0.96)',
              border: '1px solid rgba(28, 25, 23, 0.08)',
              borderRadius: '18px',
            }}
            formatter={(value) => formatProbability(Number(value) / 100)}
            labelFormatter={(_, payload) =>
              payload?.[0]
                ? new Intl.DateTimeFormat('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(payload[0].payload.timestamp))
                : ''
            }
          />
          <Area
            dataKey="price"
            fill="url(#price-wave)"
            stroke="#0f766e"
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
