'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { WindFieldData } from '@/lib/api';

interface WindLayerProps {
  windData: WindFieldData | null;
  opacity?: number;
  particleCount?: number;
  showArrows?: boolean;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

/**
 * Wind visualization layer using canvas overlay.
 * Renders animated wind particles (like Windy) over the map.
 */
export default function WindLayer({
  windData,
  opacity = 0.8,
  particleCount = 3000,
  showArrows = false,
}: WindLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!windData) return;

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

    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createRandomParticle());
    }

    function createRandomParticle(): Particle {
      const bounds = map.getBounds();
      return {
        x: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
        y: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
        age: Math.floor(Math.random() * 100),
        maxAge: 80 + Math.floor(Math.random() * 40),
      };
    }

    function getWindAtPoint(lon: number, lat: number): { u: number; v: number } {
      if (!windData) return { u: 0, v: 0 };

      // Find grid indices
      const { lats, lons, u, v } = windData;

      // Bilinear interpolation
      const lonIdx = (lon - lons[0]) / (lons[1] - lons[0]);
      const latIdx = (lat - lats[0]) / (lats[1] - lats[0]);

      const i0 = Math.floor(latIdx);
      const j0 = Math.floor(lonIdx);
      const i1 = Math.min(i0 + 1, lats.length - 1);
      const j1 = Math.min(j0 + 1, lons.length - 1);

      if (i0 < 0 || i0 >= lats.length || j0 < 0 || j0 >= lons.length) {
        return { u: 0, v: 0 };
      }

      const di = latIdx - i0;
      const dj = lonIdx - j0;

      // Bilinear interpolation for u and v
      const u00 = u[i0]?.[j0] ?? 0;
      const u01 = u[i0]?.[j1] ?? 0;
      const u10 = u[i1]?.[j0] ?? 0;
      const u11 = u[i1]?.[j1] ?? 0;

      const v00 = v[i0]?.[j0] ?? 0;
      const v01 = v[i0]?.[j1] ?? 0;
      const v10 = v[i1]?.[j0] ?? 0;
      const v11 = v[i1]?.[j1] ?? 0;

      const uInterp = (1 - di) * ((1 - dj) * u00 + dj * u01) + di * ((1 - dj) * u10 + dj * u11);
      const vInterp = (1 - di) * ((1 - dj) * v00 + dj * v01) + di * ((1 - dj) * v10 + dj * v11);

      return { u: uInterp, v: vInterp };
    }

    function resizeCanvas() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    }

    function animate() {
      if (!canvasRef.current || !windData) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const bounds = map.getBounds();
      const size = map.getSize();

      // Fade existing trails
      ctx.fillStyle = 'rgba(0, 20, 40, 0.03)';
      ctx.fillRect(0, 0, size.x, size.y);

      // Draw particles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;

      particlesRef.current.forEach((particle, idx) => {
        const wind = getWindAtPoint(particle.x, particle.y);
        const speed = Math.sqrt(wind.u * wind.u + wind.v * wind.v);

        if (speed > 0.1) {
          // Convert geo coords to pixel coords
          const point = map.latLngToContainerPoint([particle.y, particle.x]);

          // Calculate new position (scale factor for visual movement)
          const scale = 0.0005 * map.getZoom();
          const newX = particle.x + wind.u * scale;
          const newY = particle.y + wind.v * scale;

          const newPoint = map.latLngToContainerPoint([newY, newX]);

          // Draw line segment
          const alpha = Math.min(1, (particle.maxAge - particle.age) / 20);
          ctx.strokeStyle = `rgba(100, 200, 255, ${alpha * 0.8})`;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(newPoint.x, newPoint.y);
          ctx.stroke();

          // Update particle position
          particle.x = newX;
          particle.y = newY;
        }

        particle.age++;

        // Reset particle if too old or out of bounds
        if (
          particle.age > particle.maxAge ||
          particle.x < bounds.getWest() ||
          particle.x > bounds.getEast() ||
          particle.y < bounds.getSouth() ||
          particle.y > bounds.getNorth()
        ) {
          particlesRef.current[idx] = createRandomParticle();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    function drawArrows() {
      if (!canvasRef.current || !windData || !showArrows) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const { lats, lons, u, v } = windData;

      // Clear canvas for arrows
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      // Draw arrows at grid points
      for (let i = 0; i < lats.length; i += 2) {
        for (let j = 0; j < lons.length; j += 2) {
          const lat = lats[i];
          const lon = lons[j];
          const uVal = u[i][j];
          const vVal = v[i][j];

          const speed = Math.sqrt(uVal * uVal + vVal * vVal);
          if (speed < 0.5) continue;

          const point = map.latLngToContainerPoint([lat, lon]);

          // Skip if outside view
          if (point.x < 0 || point.x > size.x || point.y < 0 || point.y > size.y) {
            continue;
          }

          // Draw arrow
          const angle = Math.atan2(-vVal, uVal);  // Note: v is flipped for screen coords
          const length = Math.min(20, speed * 2);

          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(angle);

          // Color based on speed
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

    if (showArrows) {
      drawArrows();
    } else {
      animate();
    }

    // Event handlers
    const handleMoveEnd = () => {
      resizeCanvas();
      if (showArrows) {
        drawArrows();
      } else {
        // Reset particles on pan/zoom
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) {
          particlesRef.current.push(createRandomParticle());
        }
      }
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (canvasRef.current && pane) {
        pane.removeChild(canvasRef.current);
      }
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [windData, map, opacity, particleCount, showArrows]);

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
