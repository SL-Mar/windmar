#!/usr/bin/env python3
"""
Example: Rotterdam to Augusta route optimization.

Demonstrates complete workflow:
1. Initialize vessel model
2. Optimize route with synthetic weather (no external data needed)
3. Calculate fuel consumption
4. Display route statistics
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.optimization.vessel_model import VesselModel, VesselSpecs
from src.optimization.router import MaritimeRouter, RouteConstraints


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_ara_med_optimization():
    """
    Run ARA-MED route optimization example.

    Route: Rotterdam (NL) to Augusta (Sicily)
    - Distance: ~2,400 nm
    - Typical voyage: 7 days
    - Condition: Laden with product cargo
    """
    logger.info("=" * 70)
    logger.info("WINDMAR - ARA to MED Route Optimization Example")
    logger.info("=" * 70)

    # Define route endpoints
    ROTTERDAM = (51.9225, 4.4792)  # Rotterdam, Netherlands
    AUGUSTA = (37.2333, 15.2167)   # Augusta, Sicily

    # Voyage parameters
    departure_time = datetime.utcnow()
    is_laden = True
    target_speed = 14.5  # knots

    logger.info(f"Route: Rotterdam to Augusta")
    logger.info(f"Departure: {departure_time.strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"Condition: {'Laden' if is_laden else 'Ballast'}")
    logger.info(f"Target Speed: {target_speed} knots")
    logger.info("")

    # Step 1: Initialize vessel model
    logger.info("Step 1: Initializing vessel model...")
    vessel_specs = VesselSpecs()
    vessel_model = VesselModel(specs=vessel_specs)
    logger.info(f"  MR Product Tanker: {vessel_specs.dwt:.0f} DWT")
    logger.info(f"  LOA: {vessel_specs.loa}m, Beam: {vessel_specs.beam}m")
    logger.info(f"  Main Engine: {vessel_specs.mcr_kw:.0f} kW")

    # Step 2: Optimize route
    logger.info("\nStep 2: Optimizing route...")
    logger.info("  Using great circle routing (no weather data)")
    logger.info("  For weather-aware routing, use the web interface with Docker Compose")
    constraints = RouteConstraints(
        max_wind_speed_ms=25.0,
        max_wave_height_m=5.0,
        grid_resolution_deg=0.5,
    )

    router = MaritimeRouter(
        vessel_model=vessel_model,
        grib_parser_gfs=None,
        grib_parser_wave=None,
        constraints=constraints,
    )

    route_result = router.find_optimal_route(
        start_pos=ROTTERDAM,
        end_pos=AUGUSTA,
        departure_time=departure_time,
        is_laden=is_laden,
        target_speed_kts=target_speed,
    )

    # Step 3: Display results
    logger.info("\n" + "=" * 70)
    logger.info("OPTIMIZATION RESULTS")
    logger.info("=" * 70)
    logger.info(f"Total Distance:        {route_result['total_distance_nm']:.1f} nm")
    logger.info(f"Total Time:            {route_result['total_time_hours']:.1f} hours ({route_result['total_time_hours']/24:.1f} days)")
    logger.info(f"Total Fuel:            {route_result['total_fuel_mt']:.1f} MT")
    logger.info(f"Fuel per nm:           {route_result['total_fuel_mt']/route_result['total_distance_nm']:.3f} MT/nm")
    logger.info(f"Average Speed:         {route_result['total_distance_nm']/route_result['total_time_hours']:.1f} knots")
    logger.info(f"Departure:             {route_result['departure_time'].strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"Estimated Arrival:     {route_result['arrival_time'].strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"Number of Waypoints:   {len(route_result['waypoints'])}")
    logger.info("")

    # Display waypoints
    logger.info("Route Waypoints:")
    for i, (lat, lon) in enumerate(route_result['waypoints'][:5]):
        logger.info(f"  {i+1}. {lat:.4f}N, {lon:.4f}E")
    if len(route_result['waypoints']) > 10:
        logger.info(f"  ... ({len(route_result['waypoints']) - 10} more waypoints)")
    for i, (lat, lon) in enumerate(route_result['waypoints'][-5:],
                                    start=len(route_result['waypoints'])-4):
        logger.info(f"  {i}. {lat:.4f}N, {lon:.4f}E")

    # Step 4: Fuel consumption scenarios
    logger.info("\n" + "=" * 70)
    logger.info("FUEL CONSUMPTION SCENARIOS")
    logger.info("=" * 70)

    # Calm weather
    logger.info("\nScenario 1: Laden, 14.5 knots, calm weather")
    calm = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5, is_laden=True, weather=None, distance_nm=348.0,
    )
    logger.info(f"  Fuel:  {calm['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power: {calm['power_kw']:,.0f} kW ({calm['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")

    # Head wind
    logger.info("\nScenario 2: Laden, 14.5 knots, head wind 20 kts")
    wind = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5, is_laden=True,
        weather={"wind_speed_ms": 10.0, "wind_dir_deg": 0, "heading_deg": 0},
        distance_nm=348.0,
    )
    logger.info(f"  Fuel:  {wind['fuel_mt']:.2f} MT/day (+{wind['fuel_mt']-calm['fuel_mt']:.2f} MT)")
    logger.info(f"  Penalty: {(wind['fuel_mt']/calm['fuel_mt']-1)*100:.1f}%")

    # Rough seas
    logger.info("\nScenario 3: Laden, 14.5 knots, head wind 25 kts + 3m waves")
    rough = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5, is_laden=True,
        weather={
            "wind_speed_ms": 12.5, "wind_dir_deg": 0, "heading_deg": 0,
            "sig_wave_height_m": 3.0, "wave_dir_deg": 0,
        },
        distance_nm=348.0,
    )
    logger.info(f"  Fuel:  {rough['fuel_mt']:.2f} MT/day (+{rough['fuel_mt']-calm['fuel_mt']:.2f} MT)")
    logger.info(f"  Penalty: {(rough['fuel_mt']/calm['fuel_mt']-1)*100:.1f}%")

    logger.info("\n" + "=" * 70)
    logger.info("Example completed successfully!")
    logger.info("=" * 70)
    logger.info("")
    logger.info("For weather-aware route optimization with real forecasts,")
    logger.info("use the web interface: docker compose up -d --build")
    logger.info("Then open http://localhost:3003")

    return route_result


if __name__ == "__main__":
    try:
        result = run_ara_med_optimization()
        sys.exit(0)
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)
        sys.exit(1)
