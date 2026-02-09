'use client';

import { useState, useCallback, useMemo } from 'react';
import { WindFieldData, WaveFieldData } from '@/lib/api';
import { bilinearInterpolate, getGridIndices } from '@/lib/gridInterpolation';

interface WaveInfoPopupProps {
  active: boolean;
  waveData: WaveFieldData | null;
  windData: WindFieldData | null;
}

interface ClickData {
  lat: number;
  lon: number;
  totalHeight: number;
  swellHeight: number | null;
  swellPeriod: number | null;
  swellDir: number | null;
  windwaveHeight: number | null;
  windwavePeriod: number | null;
  windwaveDir: number | null;
  windSpeed: number | null;
  windDir: number | null;
}

/** Format direction as compass cardinal (e.g. 270° → "W") */
function dirLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/** SVG Polar Diagram showing wind, swell, and windwave as radial bars */
function PolarDiagram({ data }: { data: ClickData }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 75; // max bar radius from center

  // Convert met "from" direction to propagation angle for drawing
  // Met convention: direction FROM which it comes. We draw bar pointing where it goes.
  // Canvas: 0° = up (north), clockwise
  const toSvgAngle = (metDeg: number) => ((metDeg + 180) % 360) * Math.PI / 180;
  // Wind: keep "from" direction (wind blows from this direction)
  const windToSvgAngle = (metDeg: number) => (metDeg % 360) * Math.PI / 180;

  // Scale factors
  const heightScale = maxR / 5; // 5m = full radius
  const windScale = maxR / 25;  // 25 m/s = full radius

  const bars: { angle: number; length: number; color: string; label: string; detail: string }[] = [];

  if (data.windSpeed != null && data.windDir != null && data.windSpeed > 0.5) {
    bars.push({
      angle: windToSvgAngle(data.windDir),
      length: Math.min(maxR, data.windSpeed * windScale),
      color: '#00d4ff',
      label: 'WIND',
      detail: `${data.windSpeed.toFixed(1)} m/s`,
    });
  }

  if (data.swellHeight != null && data.swellDir != null && data.swellHeight > 0.1) {
    bars.push({
      angle: toSvgAngle(data.swellDir),
      length: Math.min(maxR, data.swellHeight * heightScale),
      color: '#4ade80',
      label: 'SWELL',
      detail: `${data.swellHeight.toFixed(1)}m${data.swellPeriod ? ` ${data.swellPeriod.toFixed(0)}s` : ''}`,
    });
  }

  if (data.windwaveHeight != null && data.windwaveDir != null && data.windwaveHeight > 0.1) {
    bars.push({
      angle: toSvgAngle(data.windwaveDir),
      length: Math.min(maxR, data.windwaveHeight * heightScale),
      color: '#86efac',
      label: 'WWAV',
      detail: `${data.windwaveHeight.toFixed(1)}m${data.windwavePeriod ? ` ${data.windwavePeriod.toFixed(0)}s` : ''}`,
    });
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background */}
      <circle cx={cx} cy={cy} r={maxR + 10} fill="#1a2332" opacity="0.95" />

      {/* Concentric circles */}
      {[0.33, 0.66, 1.0].map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={maxR * f}
          fill="none"
          stroke="#334155"
          strokeWidth="0.5"
        />
      ))}

      {/* Cardinal lines */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={cx + Math.sin(rad) * (maxR + 5)}
            y2={cy - Math.cos(rad) * (maxR + 5)}
            stroke="#334155"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Cardinal labels */}
      {[
        { label: 'N', x: cx, y: cy - maxR - 12 },
        { label: 'E', x: cx + maxR + 12, y: cy + 4 },
        { label: 'S', x: cx, y: cy + maxR + 16 },
        { label: 'W', x: cx - maxR - 12, y: cy + 4 },
      ].map(({ label, x, y }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
          fontWeight="bold"
        >
          {label}
        </text>
      ))}

      {/* Data bars */}
      {bars.map((bar, i) => {
        // SVG angle: 0 = north (up), clockwise
        const endX = cx + Math.sin(bar.angle) * bar.length;
        const endY = cy - Math.cos(bar.angle) * bar.length;

        // Label position (slightly beyond bar tip)
        const labelR = bar.length + 14;
        const lx = cx + Math.sin(bar.angle) * labelR;
        const ly = cy - Math.cos(bar.angle) * labelR;

        return (
          <g key={i}>
            {/* Bar line */}
            <line
              x1={cx}
              y1={cy}
              x2={endX}
              y2={endY}
              stroke={bar.color}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Arrowhead */}
            <circle cx={endX} cy={endY} r="3" fill={bar.color} />
            {/* Label */}
            <text
              x={lx}
              y={ly - 5}
              textAnchor="middle"
              fill={bar.color}
              fontSize="8"
              fontWeight="bold"
            >
              {bar.label}
            </text>
            <text
              x={lx}
              y={ly + 5}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="8"
            >
              {bar.detail}
            </text>
          </g>
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="3" fill="#e2e8f0" />

      {/* Total wave height label at bottom */}
      <text x={cx} y={size - 2} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="bold">
        Total: {data.totalHeight.toFixed(1)}m
      </text>
    </svg>
  );
}

export default function WaveInfoPopup({ active, waveData, windData }: WaveInfoPopupProps) {
  const { useMapEvents, Popup } = require('react-leaflet');
  const [clickData, setClickData] = useState<ClickData | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);

  const handleClick = useCallback(
    (e: any) => {
      if (!active || !waveData) {
        setClickData(null);
        setPosition(null);
        return;
      }

      const { lat, lng: lon } = e.latlng;

      // Check ocean mask (nearest-neighbor on high-res grid)
      const mask = waveData.ocean_mask;
      const maskLats = waveData.ocean_mask_lats || waveData.lats;
      const maskLons = waveData.ocean_mask_lons || waveData.lons;
      if (mask) {
        const maskNy = maskLats.length;
        const maskNx = maskLons.length;
        const maskLatMin = maskLats[0];
        const maskLatMax = maskLats[maskNy - 1];
        const maskLonMin = maskLons[0];
        const maskLonMax = maskLons[maskNx - 1];
        const mLatIdx = Math.round(((lat - maskLatMin) / (maskLatMax - maskLatMin)) * (maskNy - 1));
        const mLonIdx = Math.round(((lon - maskLonMin) / (maskLonMax - maskLonMin)) * (maskNx - 1));
        if (mLatIdx < 0 || mLatIdx >= maskNy || mLonIdx < 0 || mLonIdx >= maskNx || !mask[mLatIdx]?.[mLonIdx]) {
          setClickData(null);
          setPosition(null);
          return;
        }
      }

      const ny = waveData.lats.length;
      const nx = waveData.lons.length;
      const gi = getGridIndices(lat, lon, waveData.lats, waveData.lons);
      if (!gi) {
        setClickData(null);
        setPosition(null);
        return;
      }

      const { latIdx, lonIdx, latFrac, lonFrac } = gi;
      const interp = (grid: number[][] | undefined) =>
        grid ? bilinearInterpolate(grid, latIdx, lonIdx, latFrac, lonFrac, ny, nx) : null;

      const totalHeight = interp(waveData.data) ?? 0;
      const swellHeight = interp(waveData.swell?.height);
      const swellPeriod = interp(waveData.swell?.period);
      const swellDir = interp(waveData.swell?.direction);
      const windwaveHeight = interp(waveData.windwave?.height);
      const windwavePeriod = interp(waveData.windwave?.period);
      const windwaveDir = interp(waveData.windwave?.direction);

      // Wind data interpolation (different grid)
      let windSpeed: number | null = null;
      let windDir: number | null = null;
      if (windData) {
        const wny = windData.lats.length;
        const wnx = windData.lons.length;
        const wgi = getGridIndices(lat, lon, windData.lats, windData.lons);
        if (wgi) {
          const u = bilinearInterpolate(windData.u, wgi.latIdx, wgi.lonIdx, wgi.latFrac, wgi.lonFrac, wny, wnx);
          const v = bilinearInterpolate(windData.v, wgi.latIdx, wgi.lonIdx, wgi.latFrac, wgi.lonFrac, wny, wnx);
          windSpeed = Math.sqrt(u * u + v * v);
          // Meteorological "from" direction: wind blows FROM this direction
          windDir = ((270 - Math.atan2(v, u) * 180 / Math.PI) % 360 + 360) % 360;
        }
      }

      setClickData({
        lat,
        lon,
        totalHeight,
        swellHeight,
        swellPeriod,
        swellDir,
        windwaveHeight,
        windwavePeriod,
        windwaveDir,
        windSpeed,
        windDir,
      });
      setPosition([lat, lon]);
    },
    [active, waveData, windData],
  );

  useMapEvents({ click: handleClick });

  // Close popup when layer deactivates
  const prevActive = useMemo(() => ({ current: active }), []);
  if (!active && prevActive.current) {
    prevActive.current = active;
    if (clickData) {
      setClickData(null);
      setPosition(null);
    }
  }
  prevActive.current = active;

  if (!clickData || !position) return null;

  return (
    <Popup position={position} maxWidth={220} minWidth={200} closeButton={true}>
      <div style={{ margin: '-10px -5px', background: '#1a2332', borderRadius: '8px', padding: '8px' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>
          {clickData.lat.toFixed(2)}°N {clickData.lon.toFixed(2)}°E
        </div>
        <PolarDiagram data={clickData} />
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '4px', fontSize: '9px', color: '#94a3b8' }}>
          {clickData.swellDir != null && (
            <span>Swell: {dirLabel(clickData.swellDir)} {clickData.swellDir.toFixed(0)}°</span>
          )}
          {clickData.windwaveDir != null && (
            <span>WWav: {dirLabel(clickData.windwaveDir)} {clickData.windwaveDir.toFixed(0)}°</span>
          )}
        </div>
        {clickData.windDir != null && (
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
            Wind: {dirLabel(clickData.windDir)} {clickData.windDir.toFixed(0)}°
          </div>
        )}
      </div>
    </Popup>
  );
}
