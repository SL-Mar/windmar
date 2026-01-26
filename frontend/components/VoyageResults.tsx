'use client';

import { VoyageResponse, LegResult } from '@/lib/api';
import { format } from 'date-fns';
import {
  Navigation,
  Clock,
  Fuel,
  Wind,
  Waves,
  TrendingDown,
  Ship,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CloudSun,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

interface VoyageResultsProps {
  voyage: VoyageResponse;
}

/**
 * Display voyage calculation results with per-leg details.
 */
export default function VoyageResults({ voyage }: VoyageResultsProps) {
  const [expandedLegs, setExpandedLegs] = useState<Set<number>>(new Set());

  const toggleLeg = (index: number) => {
    const newExpanded = new Set(expandedLegs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLegs(newExpanded);
  };

  const formatDuration = (hours: number): string => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const minutes = Math.round((hours % 1) * 60);

    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h ${minutes}m`;
  };

  const formatDateTime = (isoString: string): string => {
    return format(new Date(isoString), 'MMM d, HH:mm');
  };

  return (
    <div className="space-y-4">
      {/* Data Source Warning */}
      {voyage.data_sources?.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-yellow-400">Weather Data Notice</div>
            <div className="text-xs text-yellow-300/80 mt-1">{voyage.data_sources.warning}</div>
            <div className="text-xs text-gray-400 mt-2 flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <CloudSun className="w-3 h-3" />
                <span>Forecast: {voyage.data_sources.forecast_legs} legs</span>
              </span>
              {voyage.data_sources.blended_legs > 0 && (
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>Blended: {voyage.data_sources.blended_legs}</span>
                </span>
              )}
              {voyage.data_sources.climatology_legs > 0 && (
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Climatology: {voyage.data_sources.climatology_legs}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Header */}
      <div className="bg-gradient-to-r from-primary-500/20 to-ocean-500/20 rounded-lg p-4 border border-primary-500/30">
        <h3 className="text-lg font-semibold text-white mb-3">Voyage Summary</h3>

        <div className="grid grid-cols-2 gap-4">
          <SummaryItem
            icon={<Navigation className="w-4 h-4" />}
            label="Distance"
            value={`${voyage.total_distance_nm.toFixed(1)} nm`}
          />
          <SummaryItem
            icon={<Clock className="w-4 h-4" />}
            label="Duration"
            value={formatDuration(voyage.total_time_hours)}
          />
          <SummaryItem
            icon={<Ship className="w-4 h-4" />}
            label="Avg SOG"
            value={`${voyage.avg_sog_kts.toFixed(1)} kts`}
          />
          <SummaryItem
            icon={<Fuel className="w-4 h-4" />}
            label="Total Fuel"
            value={`${voyage.total_fuel_mt.toFixed(1)} MT`}
          />
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-400">Departure:</span>
            <div className="text-white">{formatDateTime(voyage.departure_time)}</div>
          </div>
          <div>
            <span className="text-gray-400">Arrival (ETA):</span>
            <div className="text-white font-semibold">{formatDateTime(voyage.arrival_time)}</div>
          </div>
        </div>
      </div>

      {/* Speed Comparison */}
      <div className="bg-maritime-dark rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Speed Analysis</h4>
        <div className="space-y-2">
          <SpeedBar
            label="Calm Speed"
            value={voyage.calm_speed_kts}
            max={20}
            color="bg-green-500"
          />
          <SpeedBar
            label="Avg STW"
            value={voyage.avg_stw_kts}
            max={20}
            color="bg-yellow-500"
          />
          <SpeedBar
            label="Avg SOG"
            value={voyage.avg_sog_kts}
            max={20}
            color="bg-primary-500"
          />
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Weather impact: -{((1 - voyage.avg_sog_kts / voyage.calm_speed_kts) * 100).toFixed(1)}% speed loss
        </div>
      </div>

      {/* Leg Details */}
      <div className="bg-maritime-dark rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">
          Leg Details ({voyage.legs.length} legs)
        </h4>

        <div className="space-y-2">
          {voyage.legs.map((leg) => (
            <LegRow
              key={leg.leg_index}
              leg={leg}
              isExpanded={expandedLegs.has(leg.leg_index)}
              onToggle={() => toggleLeg(leg.leg_index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center space-x-2">
      <div className="text-primary-400">{icon}</div>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

function SpeedBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percent = (value / max) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value.toFixed(1)} kts</span>
      </div>
      <div className="h-2 bg-maritime-light rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function LegRow({
  leg,
  isExpanded,
  onToggle,
}: {
  leg: LegResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const speedLossColor =
    leg.speed_loss_pct < 5
      ? 'text-green-400'
      : leg.speed_loss_pct < 15
      ? 'text-yellow-400'
      : 'text-red-400';

  // Data source indicator color
  const getDataSourceStyle = () => {
    if (!leg.data_source) return { bg: 'bg-primary-500/20', text: 'text-primary-400' };
    switch (leg.data_source) {
      case 'forecast':
        return { bg: 'bg-green-500/20', text: 'text-green-400', icon: '☀' };
      case 'blended':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '◐' };
      case 'climatology':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '📊' };
      default:
        return { bg: 'bg-primary-500/20', text: 'text-primary-400' };
    }
  };

  const sourceStyle = getDataSourceStyle();

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-maritime-light/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className={`w-6 h-6 rounded-full ${sourceStyle.bg} flex items-center justify-center text-xs ${sourceStyle.text} font-semibold`}
            title={leg.data_source ? `Weather: ${leg.data_source}` : undefined}>
            {leg.leg_index + 1}
          </span>
          <div className="text-left">
            <div className="text-sm text-white">
              {leg.from_wp.name} → {leg.to_wp.name}
            </div>
            <div className="text-xs text-gray-400">
              {leg.distance_nm.toFixed(1)} nm · {formatHours(leg.time_hours)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{leg.sog_kts.toFixed(1)} kts</div>
            <div className={`text-xs ${speedLossColor}`}>
              {leg.speed_loss_pct > 0 ? `-${leg.speed_loss_pct.toFixed(1)}%` : 'No loss'}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-white/5 bg-maritime-light/30">
          <div className="grid grid-cols-2 gap-4 mt-3">
            {/* Weather */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center space-x-1">
                <Wind className="w-3 h-3" />
                <span>Weather</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Wind:</span>
                  <span className="text-white">
                    {leg.wind_speed_kts.toFixed(0)} kts @ {leg.wind_dir_deg.toFixed(0)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Waves:</span>
                  <span className="text-white">
                    {leg.wave_height_m.toFixed(1)} m @ {leg.wave_dir_deg.toFixed(0)}°
                  </span>
                </div>
              </div>
            </div>

            {/* Speed */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center space-x-1">
                <Ship className="w-3 h-3" />
                <span>Speed</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Calm:</span>
                  <span className="text-white">{leg.calm_speed_kts.toFixed(1)} kts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">STW:</span>
                  <span className="text-white">{leg.stw_kts.toFixed(1)} kts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">SOG:</span>
                  <span className="text-white font-semibold">{leg.sog_kts.toFixed(1)} kts</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center space-x-1">
                <Navigation className="w-3 h-3" />
                <span>Navigation</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bearing:</span>
                  <span className="text-white">{leg.bearing_deg.toFixed(1)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Distance:</span>
                  <span className="text-white">{leg.distance_nm.toFixed(1)} nm</span>
                </div>
              </div>
            </div>

            {/* Fuel */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center space-x-1">
                <Fuel className="w-3 h-3" />
                <span>Fuel</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Consumption:</span>
                  <span className="text-white">{leg.fuel_mt.toFixed(2)} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Power:</span>
                  <span className="text-white">{leg.power_kw.toFixed(0)} kW</span>
                </div>
              </div>
            </div>
          </div>

          {/* Times */}
          <div className="mt-3 pt-2 border-t border-white/5 flex justify-between text-xs">
            <div>
              <span className="text-gray-400">ETD: </span>
              <span className="text-white">
                {format(new Date(leg.departure_time), 'MMM d, HH:mm')}
              </span>
            </div>
            <div>
              <span className="text-gray-400">ETA: </span>
              <span className="text-white font-semibold">
                {format(new Date(leg.arrival_time), 'MMM d, HH:mm')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/**
 * Voyage profile chart showing weather and speed along the route.
 */
interface VoyageProfileProps {
  voyage: VoyageResponse;
}

export function VoyageProfile({ voyage }: VoyageProfileProps) {
  const maxWind = Math.max(...voyage.legs.map((l) => l.wind_speed_kts), 30);
  const maxWave = Math.max(...voyage.legs.map((l) => l.wave_height_m), 5);

  return (
    <div className="bg-maritime-dark rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-300 mb-4">Route Weather Profile</h4>

      <div className="relative h-32">
        {/* Wind bars */}
        <div className="absolute inset-0 flex items-end justify-around">
          {voyage.legs.map((leg, i) => (
            <div
              key={`wind-${i}`}
              className="w-4 bg-blue-500/50 rounded-t"
              style={{ height: `${(leg.wind_speed_kts / maxWind) * 100}%` }}
              title={`Wind: ${leg.wind_speed_kts.toFixed(0)} kts`}
            />
          ))}
        </div>

        {/* Wave line */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            points={voyage.legs
              .map((leg, i) => {
                const x = ((i + 0.5) / voyage.legs.length) * 100;
                const y = 100 - (leg.wave_height_m / maxWave) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
          />
        </svg>

        {/* SOG line */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="4,2"
            points={voyage.legs
              .map((leg, i) => {
                const x = ((i + 0.5) / voyage.legs.length) * 100;
                const y = 100 - (leg.sog_kts / 20) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-6 mt-3 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-500/50 rounded" />
          <span className="text-gray-400">Wind (kts)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-1 bg-cyan-400" />
          <span className="text-gray-400">Waves (m)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-0.5 bg-green-500 border-dashed border" />
          <span className="text-gray-400">SOG (kts)</span>
        </div>
      </div>
    </div>
  );
}
