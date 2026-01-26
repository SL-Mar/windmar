'use client';

import { useEffect, useRef } from 'react';

interface VectorData {
  name: string;
  direction: number; // degrees from north
  magnitude?: number;
  color: string;
}

interface VesselCompassProps {
  heading: number;
  cog: number;
  vectors?: VectorData[];
  rollAngle?: number;
  pitchAngle?: number;
  size?: number;
  mode?: 'N_UP' | 'H_UP' | 'C_UP';
  className?: string;
}

export default function VesselCompass({
  heading,
  cog,
  vectors = [],
  rollAngle = 0,
  pitchAngle = 0,
  size = 250,
  mode = 'N_UP',
  className = '',
}: VesselCompassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 30;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate rotation based on mode
    let rotation = 0;
    if (mode === 'H_UP') {
      rotation = -heading;
    } else if (mode === 'C_UP') {
      rotation = -cog;
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw compass rings
    drawCompassRings(ctx, centerX, centerY, radius);

    // Draw cardinal directions
    drawCardinalDirections(ctx, centerX, centerY, radius);

    // Draw degree marks
    drawDegreeMarks(ctx, centerX, centerY, radius);

    ctx.restore();

    // Draw vectors (in screen coordinates)
    vectors.forEach((vector) => {
      drawVector(ctx, centerX, centerY, radius * 0.7, vector, rotation);
    });

    // Draw vessel symbol (always centered and oriented to heading if H_UP/C_UP)
    drawVesselSymbol(ctx, centerX, centerY, heading, mode, rotation);

    // Draw COG line
    drawCOGLine(ctx, centerX, centerY, radius * 0.8, cog, rotation);

    // Draw roll/pitch indicator in corner
    if (rollAngle !== 0 || pitchAngle !== 0) {
      drawAttitudeIndicator(ctx, size - 40, 40, rollAngle, pitchAngle);
    }
  }, [heading, cog, vectors, rollAngle, pitchAngle, size, mode]);

  return (
    <div className={`bg-maritime-dark/80 backdrop-blur-sm rounded-lg border border-white/10 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white">Vessel and weather</h3>
        <div className="flex items-center space-x-1">
          {['N UP', 'H UP', 'C UP'].map((m) => (
            <button
              key={m}
              className={`px-2 py-1 text-xs rounded ${
                mode === m.replace(' ', '_')
                  ? 'bg-primary-500 text-white'
                  : 'bg-maritime-dark text-gray-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-lg"
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-0.5 bg-gray-400" />
          <span className="text-gray-400">COG</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-0.5 bg-cyan-400" />
          <span className="text-gray-400">CTW</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-blue-400" />
          <span className="text-gray-400">Wind</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-teal-400" />
          <span className="text-gray-400">Current</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-green-400" />
          <span className="text-gray-400">Wave</span>
        </div>
      </div>
    </div>
  );
}

function drawCompassRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner rings
  [0.8, 0.6, 0.4, 0.2].forEach((scale) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawCardinalDirections(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  const directions = [
    { label: 'N', angle: 0, color: '#ef4444' },
    { label: '030', angle: 30, color: '#64748b' },
    { label: '060', angle: 60, color: '#64748b' },
    { label: '090', angle: 90, color: '#64748b' },
    { label: '120', angle: 120, color: '#64748b' },
    { label: '150', angle: 150, color: '#64748b' },
    { label: '180', angle: 180, color: '#64748b' },
    { label: '210', angle: 210, color: '#64748b' },
    { label: '240', angle: 240, color: '#64748b' },
    { label: '270', angle: 270, color: '#64748b' },
    { label: '300', angle: 300, color: '#64748b' },
    { label: '330', angle: 330, color: '#64748b' },
  ];

  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  directions.forEach(({ label, angle, color }) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * (radius + 15);
    const y = cy + Math.sin(rad) * (radius + 15);

    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  });
}

function drawDegreeMarks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  for (let angle = 0; angle < 360; angle += 10) {
    const rad = ((angle - 90) * Math.PI) / 180;
    const innerRadius = angle % 30 === 0 ? radius - 8 : radius - 4;
    const x1 = cx + Math.cos(rad) * innerRadius;
    const y1 = cy + Math.sin(rad) * innerRadius;
    const x2 = cx + Math.cos(rad) * radius;
    const y2 = cy + Math.sin(rad) * radius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = angle % 30 === 0 ? '#64748b' : '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  vector: VectorData,
  baseRotation: number
) {
  const angle = ((vector.direction + baseRotation - 90) * Math.PI) / 180;
  const endX = cx + Math.cos(angle) * length;
  const endY = cy + Math.sin(angle) * length;

  // Draw line
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = vector.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw arrowhead
  const arrowSize = 8;
  const arrowAngle = Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle - arrowAngle),
    endY - arrowSize * Math.sin(angle - arrowAngle)
  );
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle + arrowAngle),
    endY - arrowSize * Math.sin(angle + arrowAngle)
  );
  ctx.closePath();
  ctx.fillStyle = vector.color;
  ctx.fill();
}

function drawVesselSymbol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  heading: number,
  mode: string,
  baseRotation: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Rotate vessel based on mode
  if (mode === 'N_UP') {
    ctx.rotate((heading * Math.PI) / 180);
  }
  // For H_UP and C_UP, vessel points up

  // Draw vessel shape
  ctx.beginPath();
  ctx.moveTo(0, -20); // Bow
  ctx.lineTo(8, 10);
  ctx.lineTo(8, 15);
  ctx.lineTo(-8, 15);
  ctx.lineTo(-8, 10);
  ctx.closePath();

  ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw center dot
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#22d3ee';
  ctx.fill();

  ctx.restore();
}

function drawCOGLine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  cog: number,
  baseRotation: number
) {
  const angle = ((cog + baseRotation - 90) * Math.PI) / 180;
  const endX = cx + Math.cos(angle) * length;
  const endY = cy + Math.sin(angle) * length;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAttitudeIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roll: number,
  pitch: number
) {
  const size = 30;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((roll * Math.PI) / 180);

  // Draw horizon line
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(size, 0);
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw pitch marks
  ctx.fillStyle = '#64748b';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`R${roll.toFixed(0)}°`, 0, -12);
  ctx.fillText(`P${pitch.toFixed(0)}°`, 0, 18);

  ctx.restore();
}
