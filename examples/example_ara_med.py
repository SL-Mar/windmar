#!/usr/bin/env python3
"""
Example: Rotterdam to Augusta route optimization.

Demonstrates complete workflow:
1. Download weather and wave forecasts
2. Optimize route considering weather
3. Visualize weather maps and route
4. Calculate fuel consumption
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.grib.extractor import GRIBExtractor
from src.grib.parser import GRIBParser
from src.optimization.vessel_model import VesselModel, VesselSpecs
from src.optimization.router import MaritimeRouter, RouteConstraints
from src.visualization.plotter import WeatherPlotter


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

    # Step 1: Download weather and wave forecasts
    logger.info("Step 1: Downloading weather forecasts...")
    extractor = GRIBExtractor(cache_dir="data/grib_cache")

    waypoints = [ROTTERDAM, AUGUSTA]

    try:
        gfs_file, wave_file = extractor.download_route_forecast(
            waypoints=waypoints,
            forecast_hours=168,  # 7 days
            buffer_degrees=2.0,
        )
        logger.info(f"✓ Downloaded GFS forecast: {gfs_file.name}")
        logger.info(f"✓ Downloaded wave forecast: {wave_file.name}")
    except Exception as e:
        logger.warning(f"Could not download forecasts: {e}")
        logger.info("Continuing with great circle route (no weather optimization)")
        gfs_file = None
        wave_file = None

    # Step 2: Parse GRIB files
    grib_parser_gfs = None
    grib_parser_wave = None

    if gfs_file and gfs_file.exists():
        try:
            logger.info("\nStep 2: Parsing GRIB files...")
            grib_parser_gfs = GRIBParser(gfs_file)
            forecast_times = grib_parser_gfs.get_forecast_times()
            logger.info(f"✓ Parsed GFS data: {len(forecast_times)} forecast times")

            if wave_file and wave_file.exists():
                grib_parser_wave = GRIBParser(wave_file)
                logger.info(f"✓ Parsed wave data")
        except ImportError:
            logger.warning("pygrib not installed - skipping weather optimization")
            logger.info("Install with: pip install pygrib")
        except Exception as e:
            logger.warning(f"Could not parse GRIB files: {e}")

    # Step 3: Initialize vessel model
    logger.info("\nStep 3: Initializing vessel model...")
    vessel_specs = VesselSpecs()
    vessel_model = VesselModel(specs=vessel_specs)
    logger.info(f"✓ MR Product Tanker: {vessel_specs.dwt:.0f} DWT")
    logger.info(f"  LOA: {vessel_specs.loa}m, Beam: {vessel_specs.beam}m")
    logger.info(f"  Main Engine: {vessel_specs.mcr_kw:.0f} kW")

    # Step 4: Optimize route
    logger.info("\nStep 4: Optimizing route...")
    constraints = RouteConstraints(
        max_wind_speed_ms=25.0,
        max_wave_height_m=5.0,
        grid_resolution_deg=0.5,
    )

    router = MaritimeRouter(
        vessel_model=vessel_model,
        grib_parser_gfs=grib_parser_gfs,
        grib_parser_wave=grib_parser_wave,
        constraints=constraints,
    )

    route_result = router.find_optimal_route(
        start_pos=ROTTERDAM,
        end_pos=AUGUSTA,
        departure_time=departure_time,
        is_laden=is_laden,
        target_speed_kts=target_speed,
    )

    # Step 5: Display results
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
        logger.info(f"  {i+1}. {lat:.4f}°N, {lon:.4f}°E")
    if len(route_result['waypoints']) > 10:
        logger.info(f"  ... ({len(route_result['waypoints']) - 10} more waypoints)")
    for i, (lat, lon) in enumerate(route_result['waypoints'][-5:],
                                    start=len(route_result['waypoints'])-4):
        logger.info(f"  {i}. {lat:.4f}°N, {lon:.4f}°E")

    # Step 6: Visualization (optional)
    logger.info("\nStep 6: Creating visualizations...")

    try:
        plotter = WeatherPlotter(use_cartopy=True)

        # Plot route on map
        if grib_parser_gfs and len(grib_parser_gfs.get_forecast_times()) > 0:
            try:
                forecast_time = grib_parser_gfs.get_forecast_times()[0]
                lats, lons, u_wind = grib_parser_gfs.get_grid_data("UGRD", forecast_time)
                _, _, v_wind = grib_parser_gfs.get_grid_data("VGRD", forecast_time)

                output_dir = Path("data")
                output_dir.mkdir(exist_ok=True)

                plotter.plot_wind_field(
                    lats, lons, u_wind, v_wind,
                    title=f"Rotterdam-Augusta Route with Wind Forecast\n{forecast_time}",
                    route=route_result['waypoints'],
                    output_file=output_dir / "ara_med_route_wind.png"
                )
                logger.info("✓ Saved wind field plot: data/ara_med_route_wind.png")
            except Exception as e:
                logger.warning(f"Could not create wind field plot: {e}")

    except Exception as e:
        logger.warning(f"Visualization failed: {e}")

    logger.info("\n" + "=" * 70)
    logger.info("✓ Example completed successfully!")
    logger.info("=" * 70)

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
