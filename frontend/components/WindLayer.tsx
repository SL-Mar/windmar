'use client';

import { useEffect, useRef, useState } from 'react';
import { WindFieldData } from '@/lib/api';

interface WindLayerProps {
  windData: WindFieldData | null;
  opacity?: number;
  particleCount?: number;
  showArrows?: boolean;
}

/**
 * Wind visualization layer using canvas overlay.
 * Renders wind arrows over the map.
 */
export default function WindLayer(props: WindLayerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <WindLayerInner {...props} />;
}

function WindLayerInner({
  windData,
  opacity = 0.8,
  showArrows = true,
}: WindLayerProps) {
  const { useMap } = require('react-leaflet');
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!windData || !showArrows) return;

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    canvas.style.opacity = String(opacity);

    const pane = map.getPane('overlayPane');
    if (pane) {
      pane.appendChild(canvas);
    }
    canvasRef.current = canvas;

    function resizeCanvas() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    }

    function drawArrows() {
      if (!canvasRef.current || !windData) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const { lats, lons, u, v } = windData;

      // Clear canvas
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      // Draw arrows at grid points
      for (let i = 0; i < lats.length; i += 2) {
        for (let j = 0; j < lons.length; j += 2) {
          const lat = lats[i];
          const lon = lons[j];
          const uVal = u[i]?.[j] ?? 0;
          const vVal = v[i]?.[j] ?? 0;

          const speed = Math.sqrt(uVal * uVal + vVal * vVal);
          if (speed < 0.5) continue;

          const point = map.latLngToContainerPoint([lat, lon]);

          // Skip if outside view
          if (point.x < 0 || point.x > size.x || point.y < 0 || point.y > size.y) {
            continue;
          }

          // Draw arrow
          const angle = Math.atan2(-vVal, uVal); // v is flipped for screen coords
          const length = Math.min(20, speed * 2);

          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(angle);

          // Color based on speed (blue = slow, red = fast)
          const hue = Math.max(0, 200 - speed * 15);
          ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.lineWidth = 1.5;

          // Arrow shaft
          ctx.beginPath();
          ctx.moveTo(-length / 2, 0);
          ctx.lineTo(length / 2, 0);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(length / 2, 0);
          ctx.lineTo(length / 2 - 5, -3);
          ctx.lineTo(length / 2 - 5, 3);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }
    }

    // Initial setup
    resizeCanvas();
    drawArrows();

    // Event handlers
    const handleMoveEnd = () => {
      resizeCanvas();
      drawArrows();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    // Cleanup
    return () => {
      if (canvasRef.current && pane) {
        pane.removeChild(canvasRef.current);
      }
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [windData, map, opacity, showArrows]);

  return null;
}

/**
 * Wind speed legend component.
 */
export function WindLegend() {
  return (
    <div className="absolute bottom-4 right-4 bg-maritime-dark/90 backdrop-blur-sm rounded-lg p-3 z-[1000]">
      <div className="text-xs text-gray-400 mb-2">Wind Speed (kts)</div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(200, 80%, 60%)' }} />
        <span className="text-xs text-white">0-10</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(150, 80%, 60%)' }} />
        <span className="text-xs text-white">10-20</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(60, 80%, 60%)' }} />
        <span className="text-xs text-white">20-30</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 80%, 60%)' }} />
        <span className="text-xs text-white">30+</span>
      </div>
    </div>
  );
}
