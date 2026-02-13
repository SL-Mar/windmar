'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';

interface FitBoundsHandlerProps {
  bounds: [[number, number], [number, number]] | null;
  fitKey: number;
}

/**
 * Child of MapContainer that calls fitBounds when fitKey changes.
 * bounds = [[south, west], [north, east]]
 */
export default function FitBoundsHandler({ bounds, fitKey }: FitBoundsHandlerProps) {
  const map = useMap();
  const prevKeyRef = useRef(fitKey);

  useEffect(() => {
    if (bounds && fitKey !== prevKeyRef.current) {
      prevKeyRef.current = fitKey;
      map.fitBounds(bounds as LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [bounds, fitKey, map]);

  return null;
}
