/**
 * API client for WINDMAR backend v2.
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Types
// ============================================================================

export interface Position {
  lat: number;
  lon: number;
}

export interface WaypointData {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export interface LegData {
  from: string;
  to: string;
  distance_nm: number;
  bearing_deg: number;
}

export interface RouteData {
  name: string;
  waypoints: WaypointData[];
  total_distance_nm: number;
  legs: LegData[];
}

// Weather types
export interface WindFieldData {
  parameter: string;
  time: string;
  bbox: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  resolution: number;
  nx: number;
  ny: number;
  lats: number[];
  lons: number[];
  u: number[][];
  v: number[][];
}

export interface WaveFieldData {
  parameter: string;
  time: string;
  bbox: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  resolution: number;
  nx: number;
  ny: number;
  lats: number[];
  lons: number[];
  data: number[][];
  unit: string;
  colorscale: {
    min: number;
    max: number;
    colors: string[];
  };
}

export interface VelocityData {
  header: {
    parameterCategory: number;
    parameterNumber: number;
    lo1: number;
    la1: number;
    lo2: number;
    la2: number;
    dx: number;
    dy: number;
    nx: number;
    ny: number;
    refTime: string;
  };
  data: number[];
}

export interface PointWeather {
  position: { lat: number; lon: number };
  time: string;
  wind: {
    speed_ms: number;
    speed_kts: number;
    dir_deg: number;
  };
  waves: {
    height_m: number;
    dir_deg: number;
  };
}

// Voyage types
export interface VoyageRequest {
  waypoints: Position[];
  calm_speed_kts: number;
  is_laden: boolean;
  departure_time?: string;
  use_weather: boolean;
}

export interface LegResult {
  leg_index: number;
  from_wp: WaypointData;
  to_wp: WaypointData;
  distance_nm: number;
  bearing_deg: number;
  wind_speed_kts: number;
  wind_dir_deg: number;
  wave_height_m: number;
  wave_dir_deg: number;
  calm_speed_kts: number;
  stw_kts: number;
  sog_kts: number;
  speed_loss_pct: number;
  time_hours: number;
  departure_time: string;
  arrival_time: string;
  fuel_mt: number;
  power_kw: number;
  // Data source info
  data_source?: 'forecast' | 'blended' | 'climatology';
  forecast_weight?: number;
}

export interface DataSourceSummary {
  forecast_legs: number;
  blended_legs: number;
  climatology_legs: number;
  forecast_horizon_days: number;
  warning?: string;
}

export interface VoyageResponse {
  route_name: string;
  departure_time: string;
  arrival_time: string;
  total_distance_nm: number;
  total_time_hours: number;
  total_fuel_mt: number;
  avg_sog_kts: number;
  avg_stw_kts: number;
  legs: LegResult[];
  calm_speed_kts: number;
  is_laden: boolean;
  // Data source summary
  data_sources?: DataSourceSummary;
}

// Vessel types
export interface VesselSpecs {
  dwt: number;
  loa: number;
  beam: number;
  draft_laden: number;
  draft_ballast: number;
  mcr_kw: number;
  sfoc_at_mcr: number;
  service_speed_laden: number;
  service_speed_ballast: number;
}

// ============================================================================
// API Functions
// ============================================================================

export const apiClient = {
  // Health check
  async healthCheck() {
    const response = await api.get('/api/health');
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Weather API (Layer 1)
  // -------------------------------------------------------------------------

  async getWindField(params: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    resolution?: number;
    time?: string;
  } = {}): Promise<WindFieldData> {
    const response = await api.get<WindFieldData>('/api/weather/wind', { params });
    return response.data;
  },

  async getWindVelocity(params: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    resolution?: number;
    time?: string;
  } = {}): Promise<VelocityData[]> {
    const response = await api.get<VelocityData[]>('/api/weather/wind/velocity', { params });
    return response.data;
  },

  async getWaveField(params: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    resolution?: number;
    time?: string;
  } = {}): Promise<WaveFieldData> {
    const response = await api.get<WaveFieldData>('/api/weather/waves', { params });
    return response.data;
  },

  async getWeatherAtPoint(lat: number, lon: number, time?: string): Promise<PointWeather> {
    const params: { lat: number; lon: number; time?: string } = { lat, lon };
    if (time) params.time = time;
    const response = await api.get<PointWeather>('/api/weather/point', { params });
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Routes API (Layer 2)
  // -------------------------------------------------------------------------

  async parseRTZ(file: File): Promise<RouteData> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<RouteData>('/api/routes/parse-rtz', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async createRouteFromWaypoints(
    waypoints: Position[],
    name: string = 'Custom Route'
  ): Promise<RouteData> {
    const response = await api.post<RouteData>(
      `/api/routes/from-waypoints?name=${encodeURIComponent(name)}`,
      waypoints
    );
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Voyage API (Layer 3)
  // -------------------------------------------------------------------------

  async calculateVoyage(request: VoyageRequest): Promise<VoyageResponse> {
    const response = await api.post<VoyageResponse>('/api/voyage/calculate', request);
    return response.data;
  },

  async getWeatherAlongRoute(
    waypoints: Position[],
    time?: string
  ): Promise<{ time: string; waypoints: Array<{
    waypoint_index: number;
    position: Position;
    wind_speed_kts: number;
    wind_dir_deg: number;
    wave_height_m: number;
    wave_dir_deg: number;
  }> }> {
    const wpString = waypoints.map(wp => `${wp.lat},${wp.lon}`).join(';');
    const params: { waypoints: string; time?: string } = { waypoints: wpString };
    if (time) params.time = time;
    const response = await api.get('/api/voyage/weather-along-route', { params });
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Vessel API
  // -------------------------------------------------------------------------

  async getVesselSpecs(): Promise<VesselSpecs> {
    const response = await api.get<VesselSpecs>('/api/vessel/specs');
    return response.data;
  },

  async updateVesselSpecs(specs: VesselSpecs): Promise<{ status: string; message: string }> {
    const response = await api.post('/api/vessel/specs', specs);
    return response.data;
  },
};

export default api;
