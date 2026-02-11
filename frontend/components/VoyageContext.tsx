'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Position, AllOptimizationResults, RouteVisibility } from '@/lib/api';
import { EMPTY_ALL_RESULTS, DEFAULT_ROUTE_VISIBILITY } from '@/lib/api';

const ZONE_TYPES = ['eca', 'seca', 'hra', 'tss', 'vts', 'ice', 'canal', 'environmental', 'exclusion'] as const;

interface VoyageContextValue {
  // Voyage params
  calmSpeed: number;
  setCalmSpeed: (v: number) => void;
  isLaden: boolean;
  setIsLaden: (v: boolean) => void;
  useWeather: boolean;
  setUseWeather: (v: boolean) => void;

  // Route state (persisted across navigation)
  waypoints: Position[];
  setWaypoints: (v: Position[]) => void;
  routeName: string;
  setRouteName: (v: string) => void;
  allResults: AllOptimizationResults;
  setAllResults: (v: AllOptimizationResults) => void;
  routeVisibility: RouteVisibility;
  setRouteVisibility: (v: RouteVisibility) => void;

  // Zone visibility per type — all false by default
  zoneVisibility: Record<string, boolean>;
  setZoneTypeVisible: (type: string, visible: boolean) => void;
  isDrawingZone: boolean;
  setIsDrawingZone: (v: boolean) => void;
}

const VoyageContext = createContext<VoyageContextValue | null>(null);

export function VoyageProvider({ children }: { children: ReactNode }) {
  const [calmSpeed, setCalmSpeed] = useState(14.5);
  const [isLaden, setIsLaden] = useState(true);
  const [useWeather, setUseWeather] = useState(true);
  const [isDrawingZone, setIsDrawingZone] = useState(false);

  // Route state (persisted)
  const [waypoints, setWaypoints] = useState<Position[]>([]);
  const [routeName, setRouteName] = useState('Custom Route');
  const [allResults, setAllResults] = useState<AllOptimizationResults>(EMPTY_ALL_RESULTS);
  const [routeVisibility, setRouteVisibility] = useState<RouteVisibility>(DEFAULT_ROUTE_VISIBILITY);

  const [zoneVisibility, setZoneVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of ZONE_TYPES) init[t] = false;
    return init;
  });

  const setZoneTypeVisible = (type: string, visible: boolean) => {
    setZoneVisibility((prev) => ({ ...prev, [type]: visible }));
  };

  return (
    <VoyageContext.Provider
      value={{
        calmSpeed, setCalmSpeed,
        isLaden, setIsLaden,
        useWeather, setUseWeather,
        waypoints, setWaypoints,
        routeName, setRouteName,
        allResults, setAllResults,
        routeVisibility, setRouteVisibility,
        zoneVisibility, setZoneTypeVisible,
        isDrawingZone, setIsDrawingZone,
      }}
    >
      {children}
    </VoyageContext.Provider>
  );
}

export function useVoyage(): VoyageContextValue {
  const ctx = useContext(VoyageContext);
  if (!ctx) throw new Error('useVoyage must be used within VoyageProvider');
  return ctx;
}

export { ZONE_TYPES };
