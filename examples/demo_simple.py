#!/usr/bin/env python3
"""
Demo: Route visualization without GRIB dependencies.

This simplified demo shows the route optimization and visualization
without requiring pygrib/cartopy installations. It uses synthetic
weather data to demonstrate the capabilities.
"""

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

# Only requires basic imports
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def run_demo_without_grib():
    """
    Run demonstration without GRIB dependencies.

    Shows:
    1. Route optimization with synthetic weather
    2. Fuel consumption calculations
    3. Route statistics
    """
    logger.info("=" * 70)
    logger.info("WINDMAR - Simple Demo (No GRIB Dependencies)")
    logger.info("=" * 70)
    logger.info("")

    # Check what's available
    logger.info("Checking dependencies...")

    has_numpy = False
    has_matplotlib = False

    try:
        import numpy as np
        has_numpy = True
        logger.info("✓ numpy available")
    except ImportError:
        logger.info("✗ numpy not installed")

    try:
        import matplotlib.pyplot as plt
        has_matplotlib = True
        logger.info("✓ matplotlib available")
    except ImportError:
        logger.info("✗ matplotlib not installed")

    if not has_numpy:
        logger.info("\nInstall dependencies with:")
        logger.info("  pip install numpy matplotlib scipy pandas openpyxl requests")
        logger.info("\nFor full GRIB support (optional, complex):")
        logger.info("  1. Install ECCODES library (system-level)")
        logger.info("  2. pip install pygrib cartopy")
        return

    logger.info("")

    # Import our modules
    from src.optimization.vessel_model import VesselModel, VesselSpecs
    from src.optimization.router import MaritimeRouter, RouteConstraints

    # Define route
    ROTTERDAM = (51.9225, 4.4792)
    AUGUSTA = (37.2333, 15.2167)

    logger.info("Route: Rotterdam → Augusta (Sicily)")
    logger.info(f"From: {ROTTERDAM[0]:.4f}°N, {ROTTERDAM[1]:.4f}°E")
    logger.info(f"To:   {AUGUSTA[0]:.4f}°N, {AUGUSTA[1]:.4f}°E")
    logger.info("")

    # Initialize vessel model
    logger.info("Initializing vessel model...")
    vessel_specs = VesselSpecs()
    vessel_model = VesselModel(specs=vessel_specs)
    logger.info(f"✓ MR Product Tanker: {vessel_specs.dwt:,.0f} DWT")
    logger.info(f"  LOA: {vessel_specs.loa}m, Beam: {vessel_specs.beam}m")
    logger.info(f"  Main Engine: {vessel_specs.mcr_kw:,.0f} kW")
    logger.info(f"  SFOC: {vessel_specs.sfoc_at_mcr} g/kWh")
    logger.info("")

    # Create router (without GRIB parsers)
    logger.info("Creating router...")
    constraints = RouteConstraints(grid_resolution_deg=2.0)  # Coarse for demo
    router = MaritimeRouter(
        vessel_model=vessel_model,
        grib_parser_gfs=None,  # No weather data
        grib_parser_wave=None,
        constraints=constraints,
    )
    logger.info("✓ Router initialized (using great circle route)")
    logger.info("")

    # Optimize route
    logger.info("Optimizing route...")
    departure_time = datetime(2024, 1, 15, 0, 0)

    result = router.find_optimal_route(
        start_pos=ROTTERDAM,
        end_pos=AUGUSTA,
        departure_time=departure_time,
        is_laden=True,
        target_speed_kts=14.5,
    )

    logger.info("✓ Route optimized!")
    logger.info("")

    # Display results
    logger.info("=" * 70)
    logger.info("ROUTE OPTIMIZATION RESULTS")
    logger.info("=" * 70)
    logger.info(f"Total Distance:      {result['total_distance_nm']:,.1f} nm")
    logger.info(f"Total Time:          {result['total_time_hours']:.1f} hours ({result['total_time_hours']/24:.1f} days)")
    logger.info(f"Total Fuel:          {result['total_fuel_mt']:.1f} MT")
    logger.info(f"Fuel Efficiency:     {result['total_fuel_mt']/result['total_distance_nm']:.3f} MT/nm")
    logger.info(f"Average Speed:       {result['total_distance_nm']/result['total_time_hours']:.2f} knots")
    logger.info(f"Departure:           {result['departure_time'].strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"ETA:                 {result['arrival_time'].strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info("")

    # Calculate fuel cost (example at $500/MT)
    fuel_cost_usd = result['total_fuel_mt'] * 500
    logger.info(f"Estimated Fuel Cost: ${fuel_cost_usd:,.0f} USD (@ $500/MT)")
    logger.info("")

    # Show waypoints
    logger.info(f"Route has {len(result['waypoints'])} waypoints:")
    for i in range(min(5, len(result['waypoints']))):
        lat, lon = result['waypoints'][i]
        logger.info(f"  {i+1}. {lat:7.3f}°N, {lon:7.3f}°E")
    if len(result['waypoints']) > 10:
        logger.info(f"  ... ({len(result['waypoints']) - 10} intermediate waypoints)")
        for i in range(max(5, len(result['waypoints']) - 5), len(result['waypoints'])):
            lat, lon = result['waypoints'][i]
            logger.info(f"  {i+1}. {lat:7.3f}°N, {lon:7.3f}°E")
    logger.info("")

    # Test fuel consumption in different conditions
    logger.info("=" * 70)
    logger.info("FUEL CONSUMPTION SCENARIOS")
    logger.info("=" * 70)
    logger.info("")

    # Scenario 1: Calm weather
    logger.info("Scenario 1: Laden, 14.5 knots, calm weather")
    calm = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5,
        is_laden=True,
        weather=None,
        distance_nm=348.0,  # One day
    )
    logger.info(f"  Fuel:  {calm['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power: {calm['power_kw']:,.0f} kW ({calm['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info("")

    # Scenario 2: Moderate wind
    logger.info("Scenario 2: Laden, 14.5 knots, head wind 20 kts")
    wind = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5,
        is_laden=True,
        weather={
            "wind_speed_ms": 10.0,  # ~20 knots
            "wind_dir_deg": 0,
            "heading_deg": 0,  # Head wind
        },
        distance_nm=348.0,
    )
    logger.info(f"  Fuel:  {wind['fuel_mt']:.2f} MT/day (+{wind['fuel_mt']-calm['fuel_mt']:.2f} MT)")
    logger.info(f"  Power: {wind['power_kw']:,.0f} kW ({wind['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info(f"  Penalty: {(wind['fuel_mt']/calm['fuel_mt']-1)*100:.1f}%")
    logger.info("")

    # Scenario 3: Rough seas
    logger.info("Scenario 3: Laden, 14.5 knots, head wind 25 kts + 3m waves")
    rough = vessel_model.calculate_fuel_consumption(
        speed_kts=14.5,
        is_laden=True,
        weather={
            "wind_speed_ms": 12.5,  # ~25 knots
            "wind_dir_deg": 0,
            "heading_deg": 0,
            "sig_wave_height_m": 3.0,
            "wave_dir_deg": 0,
        },
        distance_nm=348.0,
    )
    logger.info(f"  Fuel:  {rough['fuel_mt']:.2f} MT/day (+{rough['fuel_mt']-calm['fuel_mt']:.2f} MT)")
    logger.info(f"  Power: {rough['power_kw']:,.0f} kW ({rough['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info(f"  Penalty: {(rough['fuel_mt']/calm['fuel_mt']-1)*100:.1f}%")
    logger.info("")

    # Scenario 4: Ballast condition
    logger.info("Scenario 4: Ballast, 15.0 knots, calm weather")
    ballast = vessel_model.calculate_fuel_consumption(
        speed_kts=15.0,
        is_laden=False,
        weather=None,
        distance_nm=360.0,
    )
    logger.info(f"  Fuel:  {ballast['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power: {ballast['power_kw']:,.0f} kW ({ballast['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info(f"  vs Laden: {(ballast['fuel_mt']/calm['fuel_mt']-1)*100:.1f}% difference")
    logger.info("")

    # Create simple text-based route map if matplotlib available
    if has_matplotlib:
        logger.info("Creating route visualization...")
        try:
            import matplotlib.pyplot as plt

            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

            # Plot 1: Route on map
            waypoints = result['waypoints']
            lats = [w[0] for w in waypoints]
            lons = [w[1] for w in waypoints]

            ax1.plot(lons, lats, 'b-', linewidth=2, marker='o', markersize=4)
            ax1.plot(lons[0], lats[0], 'go', markersize=12, label='Rotterdam')
            ax1.plot(lons[-1], lats[-1], 'ro', markersize=12, label='Augusta')
            ax1.set_xlabel('Longitude (°E)', fontsize=12)
            ax1.set_ylabel('Latitude (°N)', fontsize=12)
            ax1.set_title('Rotterdam to Augusta Route', fontsize=14, fontweight='bold')
            ax1.grid(True, alpha=0.3)
            ax1.legend()
            ax1.set_aspect('equal')

            # Plot 2: Fuel comparison
            scenarios = ['Calm\nWeather', 'Head Wind\n20 kts', 'Rough Seas\n25 kts + 3m', 'Ballast\nCondition']
            fuels = [calm['fuel_mt'], wind['fuel_mt'], rough['fuel_mt'], ballast['fuel_mt']]
            colors = ['green', 'orange', 'red', 'blue']

            bars = ax2.bar(scenarios, fuels, color=colors, alpha=0.7)
            ax2.set_ylabel('Fuel Consumption (MT/day)', fontsize=12)
            ax2.set_title('Fuel Consumption Comparison', fontsize=14, fontweight='bold')
            ax2.grid(True, alpha=0.3, axis='y')

            # Add values on bars
            for bar, fuel in zip(bars, fuels):
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{fuel:.1f}',
                        ha='center', va='bottom', fontsize=10, fontweight='bold')

            plt.tight_layout()

            output_file = Path("data/windmar_demo.png")
            output_file.parent.mkdir(exist_ok=True)
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            plt.close()

            logger.info(f"✓ Visualization saved: {output_file}")
            logger.info("")
        except Exception as e:
            logger.warning(f"Could not create visualization: {e}")

    logger.info("=" * 70)
    logger.info("✓ Demo completed successfully!")
    logger.info("=" * 70)
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Install dependencies: pip install -r requirements.txt")
    logger.info("  2. Run full example: python examples/example_ara_med.py")
    logger.info("  3. Calibrate with your noon reports: python examples/example_calibration.py")
    logger.info("  4. For weather-aware routing, use Docker Compose: docker compose up -d --build")
    logger.info("")


if __name__ == "__main__":
    try:
        run_demo_without_grib()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Demo failed: {e}", exc_info=True)
        sys.exit(1)
