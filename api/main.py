"""
FastAPI Backend for WINDMAR Maritime Route Optimizer.

Provides REST API endpoints for:
- Weather data visualization (wind/wave fields)
- Route management (waypoints, RTZ import)
- Voyage calculation (per-leg SOG, ETA, fuel)
- Vessel configuration
"""

import io
import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Import WINDMAR modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.grib.extractor import GRIBExtractor
from src.optimization.vessel_model import VesselModel, VesselSpecs
from src.optimization.voyage import VoyageCalculator, LegWeather
from src.routes.rtz_parser import (
    Route, Waypoint, parse_rtz_string, create_route_from_waypoints,
    haversine_distance, calculate_bearing
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize FastAPI app
app = FastAPI(
    title="WINDMAR API",
    description="Maritime Route Optimization API - Weather, Routes, Voyage Planning",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Pydantic Models
# ============================================================================

class Position(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class WaypointModel(BaseModel):
    id: int
    name: str
    lat: float
    lon: float


class RouteModel(BaseModel):
    name: str
    waypoints: List[WaypointModel]


class VoyageRequest(BaseModel):
    """Request for voyage calculation."""
    waypoints: List[Position]
    calm_speed_kts: float = Field(..., gt=0, lt=30, description="Calm water speed in knots")
    is_laden: bool = True
    departure_time: Optional[datetime] = None
    use_weather: bool = True


class LegResultModel(BaseModel):
    """Result for a single leg."""
    leg_index: int
    from_wp: WaypointModel
    to_wp: WaypointModel
    distance_nm: float
    bearing_deg: float

    # Weather
    wind_speed_kts: float
    wind_dir_deg: float
    wave_height_m: float
    wave_dir_deg: float

    # Speeds
    calm_speed_kts: float
    stw_kts: float
    sog_kts: float
    speed_loss_pct: float

    # Time
    time_hours: float
    departure_time: datetime
    arrival_time: datetime

    # Fuel
    fuel_mt: float
    power_kw: float


class VoyageResponse(BaseModel):
    """Complete voyage calculation response."""
    route_name: str
    departure_time: datetime
    arrival_time: datetime

    total_distance_nm: float
    total_time_hours: float
    total_fuel_mt: float
    avg_sog_kts: float
    avg_stw_kts: float

    legs: List[LegResultModel]

    calm_speed_kts: float
    is_laden: bool


class WindDataPoint(BaseModel):
    """Wind data at a point."""
    lat: float
    lon: float
    u: float  # U component (m/s)
    v: float  # V component (m/s)
    speed_kts: float
    dir_deg: float


class WeatherGridResponse(BaseModel):
    """Weather grid data for visualization."""
    parameter: str
    time: datetime
    bbox: Dict[str, float]
    resolution: float
    nx: int
    ny: int
    lats: List[float]
    lons: List[float]
    data: List[List[float]]  # 2D grid


class VelocityDataResponse(BaseModel):
    """Wind velocity data in leaflet-velocity format."""
    header: Dict
    data_u: List[float]
    data_v: List[float]


class VesselConfig(BaseModel):
    """Vessel configuration."""
    dwt: float = 49000.0
    loa: float = 183.0
    beam: float = 32.0
    draft_laden: float = 11.8
    draft_ballast: float = 6.5
    mcr_kw: float = 8840.0
    sfoc_at_mcr: float = 171.0
    service_speed_laden: float = 14.5
    service_speed_ballast: float = 15.0


# ============================================================================
# Global State
# ============================================================================

grib_extractor = GRIBExtractor(cache_dir="data/grib_cache")
current_vessel_specs = VesselSpecs()
current_vessel_model = VesselModel(specs=current_vessel_specs)
voyage_calculator = VoyageCalculator(vessel_model=current_vessel_model)

# Cache for parsed GRIB data
_weather_cache: Dict[str, any] = {}


# ============================================================================
# Helper Functions
# ============================================================================

def generate_sample_wind_field(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    resolution: float = 1.0,
    time: datetime = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate sample wind field for development/demo.

    In production, this would be replaced with actual GRIB data.
    Creates realistic-looking wind patterns.
    """
    lats = np.arange(lat_min, lat_max + resolution, resolution)
    lons = np.arange(lon_min, lon_max + resolution, resolution)

    lon_grid, lat_grid = np.meshgrid(lons, lats)

    # Create realistic wind patterns
    # Base westerlies in mid-latitudes
    base_u = 5.0 + 3.0 * np.sin(np.radians(lat_grid * 2))
    base_v = 2.0 * np.cos(np.radians(lon_grid * 3 + lat_grid * 2))

    # Add some variability based on time
    if time:
        hour_factor = np.sin(time.hour * np.pi / 12)
    else:
        hour_factor = 0.5

    # Add weather system pattern (moving low pressure)
    center_lat = 45.0 + 5.0 * hour_factor
    center_lon = 0.0 + 10.0 * hour_factor

    dist = np.sqrt((lat_grid - center_lat)**2 + (lon_grid - center_lon)**2)
    system_strength = 8.0 * np.exp(-dist / 10.0)

    # Cyclonic rotation (Northern Hemisphere)
    angle_to_center = np.arctan2(lat_grid - center_lat, lon_grid - center_lon)
    u_cyclonic = -system_strength * np.sin(angle_to_center + np.pi/2)
    v_cyclonic = system_strength * np.cos(angle_to_center + np.pi/2)

    u_wind = base_u + u_cyclonic + np.random.randn(*lat_grid.shape) * 0.5
    v_wind = base_v + v_cyclonic + np.random.randn(*lat_grid.shape) * 0.5

    return lats, lons, u_wind, v_wind


def generate_sample_wave_field(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    resolution: float = 1.0,
    u_wind: np.ndarray = None,
    v_wind: np.ndarray = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate sample wave field based on wind.

    Wave height correlates with wind speed.
    """
    lats = np.arange(lat_min, lat_max + resolution, resolution)
    lons = np.arange(lon_min, lon_max + resolution, resolution)

    lon_grid, lat_grid = np.meshgrid(lons, lats)

    if u_wind is not None and v_wind is not None:
        wind_speed = np.sqrt(u_wind**2 + v_wind**2)
        # Wave height roughly 0.15 * wind_speed for fully developed seas
        wave_height = 0.15 * wind_speed + np.random.randn(*wind_speed.shape) * 0.3
        wave_height = np.maximum(wave_height, 0.5)  # Minimum swell
    else:
        # Default wave pattern
        wave_height = 1.5 + 1.0 * np.sin(np.radians(lat_grid * 3)) + np.random.randn(*lat_grid.shape) * 0.2
        wave_height = np.maximum(wave_height, 0.3)

    return lats, lons, wave_height


def get_weather_at_point(lat: float, lon: float, time: datetime) -> Dict:
    """
    Get weather at a specific point.

    Uses sample data for demo. In production, would query GRIB cache.
    """
    # Generate localized sample
    lats, lons, u, v = generate_sample_wind_field(
        lat - 1, lat + 1, lon - 1, lon + 1, 0.5, time
    )

    # Find nearest grid point
    lat_idx = np.argmin(np.abs(lats - lat))
    lon_idx = np.argmin(np.abs(lons - lon))

    u_val = u[lat_idx, lon_idx]
    v_val = v[lat_idx, lon_idx]

    wind_speed = np.sqrt(u_val**2 + v_val**2)
    wind_dir = (np.degrees(np.arctan2(-u_val, -v_val)) + 360) % 360

    # Wave height from wind
    wave_height = max(0.5, 0.15 * wind_speed + np.random.randn() * 0.3)
    wave_dir = (wind_dir + 15) % 360  # Waves typically offset from wind

    return {
        'wind_speed_ms': float(wind_speed),
        'wind_dir_deg': float(wind_dir),
        'sig_wave_height_m': float(wave_height),
        'wave_dir_deg': float(wave_dir),
    }


def weather_provider(lat: float, lon: float, time: datetime) -> LegWeather:
    """Weather provider function for voyage calculator."""
    wx = get_weather_at_point(lat, lon, time)
    return LegWeather(
        wind_speed_ms=wx['wind_speed_ms'],
        wind_dir_deg=wx['wind_dir_deg'],
        sig_wave_height_m=wx['sig_wave_height_m'],
        wave_dir_deg=wx['wave_dir_deg'],
    )


# ============================================================================
# API Endpoints - Core
# ============================================================================

@app.get("/")
async def root():
    """API root."""
    return {
        "name": "WINDMAR API",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/api/docs",
        "endpoints": {
            "weather": "/api/weather/...",
            "routes": "/api/routes/...",
            "voyage": "/api/voyage/...",
            "vessel": "/api/vessel/...",
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ============================================================================
# API Endpoints - Weather (Layer 1)
# ============================================================================

@app.get("/api/weather/wind")
async def get_wind_field(
    lat_min: float = Query(30.0, ge=-90, le=90),
    lat_max: float = Query(60.0, ge=-90, le=90),
    lon_min: float = Query(-15.0, ge=-180, le=180),
    lon_max: float = Query(40.0, ge=-180, le=180),
    resolution: float = Query(1.0, ge=0.25, le=5.0),
    time: Optional[datetime] = None,
):
    """
    Get wind field data for visualization.

    Returns U/V wind components on a grid.
    """
    if time is None:
        time = datetime.utcnow()

    lats, lons, u_wind, v_wind = generate_sample_wind_field(
        lat_min, lat_max, lon_min, lon_max, resolution, time
    )

    return {
        "parameter": "wind",
        "time": time.isoformat(),
        "bbox": {
            "lat_min": lat_min,
            "lat_max": lat_max,
            "lon_min": lon_min,
            "lon_max": lon_max,
        },
        "resolution": resolution,
        "nx": len(lons),
        "ny": len(lats),
        "lats": lats.tolist(),
        "lons": lons.tolist(),
        "u": u_wind.tolist(),
        "v": v_wind.tolist(),
    }


@app.get("/api/weather/wind/velocity")
async def get_wind_velocity_format(
    lat_min: float = Query(30.0),
    lat_max: float = Query(60.0),
    lon_min: float = Query(-15.0),
    lon_max: float = Query(40.0),
    resolution: float = Query(1.0),
    time: Optional[datetime] = None,
):
    """
    Get wind data in leaflet-velocity compatible format.

    Returns array of [U-component, V-component] data with headers.
    """
    if time is None:
        time = datetime.utcnow()

    lats, lons, u_wind, v_wind = generate_sample_wind_field(
        lat_min, lat_max, lon_min, lon_max, resolution, time
    )

    # leaflet-velocity format
    header = {
        "parameterCategory": 2,
        "parameterNumber": 2,
        "lo1": lon_min,
        "la1": lat_max,  # Note: lat goes from top to bottom
        "lo2": lon_max,
        "la2": lat_min,
        "dx": resolution,
        "dy": resolution,
        "nx": len(lons),
        "ny": len(lats),
        "refTime": time.isoformat(),
    }

    # Flatten data (row-major, from top-left)
    u_flat = u_wind[::-1].flatten().tolist()  # Flip lat axis
    v_flat = v_wind[::-1].flatten().tolist()

    return [
        {"header": {**header, "parameterNumber": 2}, "data": u_flat},
        {"header": {**header, "parameterNumber": 3}, "data": v_flat},
    ]


@app.get("/api/weather/waves")
async def get_wave_field(
    lat_min: float = Query(30.0),
    lat_max: float = Query(60.0),
    lon_min: float = Query(-15.0),
    lon_max: float = Query(40.0),
    resolution: float = Query(1.0),
    time: Optional[datetime] = None,
):
    """
    Get wave height field for visualization.
    """
    if time is None:
        time = datetime.utcnow()

    # Get wind first
    _, _, u_wind, v_wind = generate_sample_wind_field(
        lat_min, lat_max, lon_min, lon_max, resolution, time
    )

    # Generate waves based on wind
    lats, lons, wave_height = generate_sample_wave_field(
        lat_min, lat_max, lon_min, lon_max, resolution, u_wind, v_wind
    )

    return {
        "parameter": "wave_height",
        "time": time.isoformat(),
        "bbox": {
            "lat_min": lat_min,
            "lat_max": lat_max,
            "lon_min": lon_min,
            "lon_max": lon_max,
        },
        "resolution": resolution,
        "nx": len(lons),
        "ny": len(lats),
        "lats": lats.tolist(),
        "lons": lons.tolist(),
        "data": wave_height.tolist(),
        "unit": "m",
        "colorscale": {
            "min": 0,
            "max": 6,
            "colors": ["#00ff00", "#ffff00", "#ff8800", "#ff0000", "#800000"],
        }
    }


@app.get("/api/weather/point")
async def get_weather_point(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    time: Optional[datetime] = None,
):
    """
    Get weather at a specific point.
    """
    if time is None:
        time = datetime.utcnow()

    wx = get_weather_at_point(lat, lon, time)

    return {
        "position": {"lat": lat, "lon": lon},
        "time": time.isoformat(),
        "wind": {
            "speed_ms": wx['wind_speed_ms'],
            "speed_kts": wx['wind_speed_ms'] * 1.94384,
            "dir_deg": wx['wind_dir_deg'],
        },
        "waves": {
            "height_m": wx['sig_wave_height_m'],
            "dir_deg": wx['wave_dir_deg'],
        }
    }


# ============================================================================
# API Endpoints - Routes (Layer 2)
# ============================================================================

@app.post("/api/routes/parse-rtz")
async def parse_rtz(file: UploadFile = File(...)):
    """
    Parse an uploaded RTZ route file.

    Returns waypoints in standard format.
    """
    try:
        content = await file.read()
        rtz_string = content.decode('utf-8')

        route = parse_rtz_string(rtz_string)

        return {
            "name": route.name,
            "waypoints": [
                {
                    "id": wp.id,
                    "name": wp.name,
                    "lat": wp.lat,
                    "lon": wp.lon,
                }
                for wp in route.waypoints
            ],
            "total_distance_nm": route.total_distance_nm,
            "legs": [
                {
                    "from": leg.from_wp.name,
                    "to": leg.to_wp.name,
                    "distance_nm": leg.distance_nm,
                    "bearing_deg": leg.bearing_deg,
                }
                for leg in route.legs
            ]
        }
    except Exception as e:
        logger.error(f"Failed to parse RTZ: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid RTZ file: {str(e)}")


@app.post("/api/routes/from-waypoints")
async def create_route_from_wps(
    waypoints: List[Position],
    name: str = "Custom Route",
):
    """
    Create a route from a list of waypoints.

    Returns route with calculated distances and bearings.
    """
    if len(waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")

    wps = [(wp.lat, wp.lon) for wp in waypoints]
    route = create_route_from_waypoints(wps, name)

    return {
        "name": route.name,
        "waypoints": [
            {
                "id": wp.id,
                "name": wp.name,
                "lat": wp.lat,
                "lon": wp.lon,
            }
            for wp in route.waypoints
        ],
        "total_distance_nm": route.total_distance_nm,
        "legs": [
            {
                "from": leg.from_wp.name,
                "to": leg.to_wp.name,
                "distance_nm": leg.distance_nm,
                "bearing_deg": leg.bearing_deg,
            }
            for leg in route.legs
        ]
    }


# ============================================================================
# API Endpoints - Voyage Calculation (Layer 3)
# ============================================================================

@app.post("/api/voyage/calculate", response_model=VoyageResponse)
async def calculate_voyage(request: VoyageRequest):
    """
    Calculate voyage with per-leg SOG, ETA, and fuel.

    Takes waypoints, calm speed, and vessel condition.
    Returns detailed per-leg results including weather impact.
    """
    if len(request.waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")

    departure = request.departure_time or datetime.utcnow()

    # Create route from waypoints
    wps = [(wp.lat, wp.lon) for wp in request.waypoints]
    route = create_route_from_waypoints(wps, "Voyage Route")

    # Calculate voyage
    wp_func = weather_provider if request.use_weather else None

    result = voyage_calculator.calculate_voyage(
        route=route,
        calm_speed_kts=request.calm_speed_kts,
        is_laden=request.is_laden,
        departure_time=departure,
        weather_provider=wp_func,
    )

    # Format response
    legs_response = []
    for leg in result.legs:
        legs_response.append(LegResultModel(
            leg_index=leg.leg_index,
            from_wp=WaypointModel(
                id=leg.from_wp.id,
                name=leg.from_wp.name,
                lat=leg.from_wp.lat,
                lon=leg.from_wp.lon,
            ),
            to_wp=WaypointModel(
                id=leg.to_wp.id,
                name=leg.to_wp.name,
                lat=leg.to_wp.lat,
                lon=leg.to_wp.lon,
            ),
            distance_nm=round(leg.distance_nm, 2),
            bearing_deg=round(leg.bearing_deg, 1),
            wind_speed_kts=round(leg.weather.wind_speed_ms * 1.94384, 1),
            wind_dir_deg=round(leg.weather.wind_dir_deg, 0),
            wave_height_m=round(leg.weather.sig_wave_height_m, 1),
            wave_dir_deg=round(leg.weather.wave_dir_deg, 0),
            calm_speed_kts=round(leg.calm_speed_kts, 1),
            stw_kts=round(leg.stw_kts, 1),
            sog_kts=round(leg.sog_kts, 1),
            speed_loss_pct=round(leg.speed_loss_pct, 1),
            time_hours=round(leg.time_hours, 2),
            departure_time=leg.departure_time,
            arrival_time=leg.arrival_time,
            fuel_mt=round(leg.fuel_mt, 2),
            power_kw=round(leg.power_kw, 0),
        ))

    return VoyageResponse(
        route_name=result.route_name,
        departure_time=result.departure_time,
        arrival_time=result.arrival_time,
        total_distance_nm=round(result.total_distance_nm, 2),
        total_time_hours=round(result.total_time_hours, 2),
        total_fuel_mt=round(result.total_fuel_mt, 2),
        avg_sog_kts=round(result.avg_sog_kts, 1),
        avg_stw_kts=round(result.avg_stw_kts, 1),
        legs=legs_response,
        calm_speed_kts=request.calm_speed_kts,
        is_laden=request.is_laden,
    )


@app.get("/api/voyage/weather-along-route")
async def get_weather_along_route(
    waypoints: str = Query(..., description="Comma-separated lat,lon pairs: lat1,lon1;lat2,lon2;..."),
    time: Optional[datetime] = None,
):
    """
    Get weather conditions at each waypoint and leg midpoint.
    """
    if time is None:
        time = datetime.utcnow()

    # Parse waypoints
    try:
        wps = []
        for wp_str in waypoints.split(';'):
            lat, lon = wp_str.strip().split(',')
            wps.append((float(lat), float(lon)))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid waypoints format: {e}")

    if len(wps) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")

    # Get weather at each point
    result = []
    for i, (lat, lon) in enumerate(wps):
        wx = get_weather_at_point(lat, lon, time)
        result.append({
            "waypoint_index": i,
            "position": {"lat": lat, "lon": lon},
            "wind_speed_kts": round(wx['wind_speed_ms'] * 1.94384, 1),
            "wind_dir_deg": round(wx['wind_dir_deg'], 0),
            "wave_height_m": round(wx['sig_wave_height_m'], 1),
            "wave_dir_deg": round(wx['wave_dir_deg'], 0),
        })

    return {"time": time.isoformat(), "waypoints": result}


# ============================================================================
# API Endpoints - Vessel Configuration
# ============================================================================

@app.get("/api/vessel/specs")
async def get_vessel_specs():
    """Get current vessel specifications."""
    specs = current_vessel_specs
    return {
        "dwt": specs.dwt,
        "loa": specs.loa,
        "beam": specs.beam,
        "draft_laden": specs.draft_laden,
        "draft_ballast": specs.draft_ballast,
        "mcr_kw": specs.mcr_kw,
        "sfoc_at_mcr": specs.sfoc_at_mcr,
        "service_speed_laden": specs.service_speed_laden,
        "service_speed_ballast": specs.service_speed_ballast,
    }


@app.post("/api/vessel/specs")
async def update_vessel_specs(config: VesselConfig):
    """Update vessel specifications."""
    global current_vessel_specs, current_vessel_model, voyage_calculator

    try:
        current_vessel_specs = VesselSpecs(
            dwt=config.dwt,
            loa=config.loa,
            beam=config.beam,
            draft_laden=config.draft_laden,
            draft_ballast=config.draft_ballast,
            mcr_kw=config.mcr_kw,
            sfoc_at_mcr=config.sfoc_at_mcr,
            service_speed_laden=config.service_speed_laden,
            service_speed_ballast=config.service_speed_ballast,
        )
        current_vessel_model = VesselModel(specs=current_vessel_specs)
        voyage_calculator = VoyageCalculator(vessel_model=current_vessel_model)

        return {"status": "success", "message": "Vessel specs updated"}

    except Exception as e:
        logger.error(f"Failed to update vessel specs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
