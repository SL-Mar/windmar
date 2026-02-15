'use client';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { EngineLogEntryResponse } from '@/lib/api';

const MARITIME_TOOLTIP = {
  backgroundColor: 'rgba(26, 41, 66, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
};

const AXIS_STYLE = { fontSize: '12px' };
const GRID_STROKE = 'rgba(255,255,255,0.1)';

// ─── Fuel Timeline ─────────────────────────────────────────────────────────

interface FuelTimelineChartProps {
  entries: EngineLogEntryResponse[];
}

export function FuelTimelineChart({ entries }: FuelTimelineChartProps) {
  const data = entries
    .filter(e => e.hfo_total_mt != null || e.mgo_total_mt != null)
    .map(e => ({
      time: new Date(e.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      ts: new Date(e.timestamp).getTime(),
      HFO: e.hfo_total_mt ?? 0,
      MGO: e.mgo_total_mt ?? 0,
    }))
    .sort((a, b) => a.ts - b.ts);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No fuel data</div>;
  }

  // Cap Y-axis at 95th percentile to avoid outlier spikes compressing the chart
  const allVals = data.flatMap(d => [d.HFO, d.MGO]).filter(v => v > 0).sort((a, b) => a - b);
  const p95 = allVals.length > 0 ? allVals[Math.floor(allVals.length * 0.95)] : 10;
  const yMax = Math.ceil(p95 * 1.2);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="time" stroke="#9ca3af" style={AXIS_STYLE} />
        <YAxis
          stroke="#9ca3af"
          style={AXIS_STYLE}
          domain={[0, yMax]}
          label={{ value: 'MT', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
        />
        <Tooltip contentStyle={MARITIME_TOOLTIP} labelStyle={{ color: '#fff' }} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
        <Line type="monotone" dataKey="HFO" stroke="#0073e6" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="MGO" stroke="#00b4d8" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── RPM Distribution ──────────────────────────────────────────────────────

interface RpmDistributionChartProps {
  entries: EngineLogEntryResponse[];
}

export function RpmDistributionChart({ entries }: RpmDistributionChartProps) {
  const noonRpms = entries
    .filter(e => e.event === 'NOON' && e.rpm != null && e.rpm > 0)
    .map(e => e.rpm!);

  if (noonRpms.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No NOON RPM data</div>;
  }

  const minRpm = Math.floor(Math.min(...noonRpms) / 10) * 10;
  const maxRpm = Math.ceil(Math.max(...noonRpms) / 10) * 10;

  const buckets: Record<string, number> = {};
  for (let r = minRpm; r < maxRpm; r += 10) {
    buckets[`${r}-${r + 10}`] = 0;
  }
  for (const rpm of noonRpms) {
    const bucket = Math.floor(rpm / 10) * 10;
    const key = `${bucket}-${bucket + 10}`;
    if (key in buckets) buckets[key]++;
  }

  const data = Object.entries(buckets).map(([range, count]) => ({ range, count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="range" stroke="#9ca3af" style={AXIS_STYLE} />
        <YAxis
          stroke="#9ca3af"
          style={AXIS_STYLE}
          label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
        />
        <Tooltip contentStyle={MARITIME_TOOLTIP} labelStyle={{ color: '#fff' }} />
        <Bar dataKey="count" name="Entries" fill="#008ba2" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Speed Timeline ────────────────────────────────────────────────────────

interface SpeedTimelineChartProps {
  entries: EngineLogEntryResponse[];
  serviceSpeed?: number;
}

export function SpeedTimelineChart({ entries, serviceSpeed = 13 }: SpeedTimelineChartProps) {
  const data = entries
    .filter(e => e.speed_stw != null && e.speed_stw > 0)
    .map(e => ({
      time: new Date(e.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      ts: new Date(e.timestamp).getTime(),
      speed: e.speed_stw,
    }))
    .sort((a, b) => a.ts - b.ts);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No speed data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="time" stroke="#9ca3af" style={AXIS_STYLE} />
        <YAxis
          stroke="#9ca3af"
          style={AXIS_STYLE}
          label={{ value: 'kts', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
        />
        <Tooltip contentStyle={MARITIME_TOOLTIP} labelStyle={{ color: '#fff' }} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
        <ReferenceLine y={serviceSpeed} stroke="#f59e0b" strokeDasharray="6 4" label={{ value: `Service ${serviceSpeed} kts`, fill: '#f59e0b', fontSize: 11, position: 'right' }} />
        <Line type="monotone" dataKey="speed" name="Speed STW" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Event Breakdown Pie ───────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  NOON: '#3b82f6',
  SOSP: '#f59e0b',
  EOSP: '#f97316',
  ALL_FAST: '#22c55e',
  DRIFTING: '#a855f7',
  ANCHORED: '#06b6d4',
  BUNKERING: '#ec4899',
  UNKNOWN: '#6b7280',
};

interface EventBreakdownChartProps {
  eventsBreakdown: Record<string, number>;
}

export function EventBreakdownChart({ eventsBreakdown }: EventBreakdownChartProps) {
  const raw = Object.entries(eventsBreakdown).map(([name, value]) => ({ name, value }));

  if (raw.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No event data</div>;
  }

  // Group events below 3% into "Other"
  const total = raw.reduce((s, e) => s + e.value, 0);
  const threshold = total * 0.03;
  let otherSum = 0;
  const data = raw.filter(e => {
    if (e.value >= threshold) return true;
    otherSum += e.value;
    return false;
  });
  if (otherSum > 0) data.push({ name: 'Other', value: otherSum });

  // Sort descending so largest slices are first
  data.sort((a, b) => b.value - a.value);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={EVENT_COLORS[entry.name] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={MARITIME_TOOLTIP}
              labelStyle={{ color: '#fff' }}
              formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Compact inline legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center pt-1 pb-1">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[entry.name] || '#6b7280' }} />
            <span className="text-xs text-gray-400">{entry.name}</span>
            <span className="text-xs text-gray-500">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
