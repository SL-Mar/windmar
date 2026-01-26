'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Settings, Maximize2, Download } from 'lucide-react';

interface DataSeries {
  name: string;
  color: string;
  data: { time: Date; value: number }[];
  unit: string;
  dashed?: boolean;
}

interface TimeSeriesPanelProps {
  title: string;
  series: DataSeries[];
  currentValues?: { name: string; value: number; unit: string; color: string }[];
  height?: number;
  timeRangeMinutes?: number;
  yAxisDomain?: [number, number] | ['auto', 'auto'];
  className?: string;
}

export default function TimeSeriesPanel({
  title,
  series,
  currentValues,
  height = 200,
  timeRangeMinutes = 60,
  yAxisDomain = ['auto', 'auto'],
  className = '',
}: TimeSeriesPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Prepare chart data - combine all series into one data array
  const chartData = prepareChartData(series, timeRangeMinutes);

  return (
    <div
      className={`bg-maritime-dark/80 backdrop-blur-sm rounded-lg border border-white/10 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex items-center space-x-2">
          {/* Control buttons like MIROS */}
          <button className="p-1 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-400 hover:text-white transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-400 hover:text-white transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Chart area */}
        <div className="flex-1 p-2" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}-${date.toLocaleString('en', { month: 'short' })}`;
                }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                domain={yAxisDomain}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              {series.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray={s.dashed ? '5 5' : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Current values panel (right side like MIROS) */}
        {currentValues && currentValues.length > 0 && (
          <div className="w-32 border-l border-white/10 p-3 flex flex-col justify-center space-y-3">
            {currentValues.map((cv) => (
              <div key={cv.name} className="text-right">
                <div className="text-xs text-gray-400">{cv.name}</div>
                <div className="flex items-baseline justify-end">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: cv.color }}
                  >
                    {cv.value.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">{cv.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/10 flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.name} className="flex items-center space-x-2">
            <div
              className="w-4 h-0.5"
              style={{
                backgroundColor: s.color,
                borderStyle: s.dashed ? 'dashed' : 'solid',
              }}
            />
            <span className="text-xs text-gray-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to prepare chart data
function prepareChartData(series: DataSeries[], timeRangeMinutes: number) {
  // Get all unique timestamps
  const allTimes = new Set<number>();
  series.forEach((s) => {
    s.data.forEach((d) => allTimes.add(d.time.getTime()));
  });

  // Sort times
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  // Filter to time range
  const cutoff = Date.now() - timeRangeMinutes * 60 * 1000;
  const filteredTimes = sortedTimes.filter((t) => t >= cutoff);

  // Build data array
  return filteredTimes.map((time) => {
    const point: Record<string, any> = { time };
    series.forEach((s) => {
      const match = s.data.find((d) => d.time.getTime() === time);
      point[s.name] = match?.value ?? null;
    });
    return point;
  });
}

// Simplified panel for single value display
export function LiveValuePanel({
  title,
  value,
  unit,
  color = '#22d3ee',
  subtitle,
  trend,
  className = '',
}: {
  title: string;
  value: number;
  unit: string;
  color?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
}) {
  return (
    <div
      className={`bg-maritime-dark/80 backdrop-blur-sm rounded-lg border border-white/10 p-4 ${className}`}
    >
      <div className="text-xs text-gray-400 mb-1">{title}</div>
      <div className="flex items-baseline">
        <span
          className="text-3xl font-bold tabular-nums"
          style={{ color }}
        >
          {value.toFixed(1)}
        </span>
        <span className="text-sm text-gray-400 ml-1">{unit}</span>
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
