#!/usr/bin/env python3
"""
Example: Vessel performance calibration from noon reports.

Demonstrates:
1. Parsing noon reports from Excel
2. Calibrating vessel model
3. Comparing predicted vs observed fuel consumption
4. Generating calibration report
"""

import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database.excel_parser import ExcelParser
from src.database.calibration import ModelCalibrator
from src.optimization.vessel_model import VesselSpecs


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_sample_noon_reports(output_file: Path) -> None:
    """
    Create sample noon report Excel file for demonstration.

    In practice, users would provide their own noon reports.

    Args:
        output_file: Path to output Excel file
    """
    logger.info(f"Creating sample noon reports: {output_file}")

    # Generate synthetic noon report data
    np.random.seed(42)

    dates = pd.date_range(start="2024-01-01", periods=30, freq="D")

    data = {
        "Date": dates,
        "Latitude": np.random.uniform(35, 55, 30),
        "Longitude": np.random.uniform(-5, 15, 30),
        "Speed": np.random.uniform(13, 15.5, 30),
        "Distance": np.random.uniform(300, 370, 30),
        "Fuel_Consumption": np.random.uniform(28, 42, 30),
        "Wind_Speed": np.random.uniform(3, 8, 30),  # Beaufort
        "Wind_Direction": np.random.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"], 30),
        "Wave_Height": np.random.uniform(1, 3.5, 30),  # meters
        "Draft_Fwd": np.random.choice([11.5, 11.8, 6.5], 30),
        "Draft_Aft": np.random.choice([11.8, 12.0, 6.8], 30),
        "Condition": np.random.choice(["Laden", "Ballast"], 30),
    }

    df = pd.DataFrame(data)

    # Add realistic correlation between speed and fuel
    for i in range(len(df)):
        speed = df.loc[i, "Speed"]
        is_laden = df.loc[i, "Condition"] == "Laden"
        wind = df.loc[i, "Wind_Speed"]

        # Base fuel (cubic relationship with speed)
        base_fuel = 12 + 0.08 * (speed ** 2.5)

        # Loading condition effect
        if is_laden:
            base_fuel *= 1.15

        # Weather effect
        base_fuel += wind * 0.5

        # Add noise
        df.loc[i, "Fuel_Consumption"] = base_fuel * np.random.uniform(0.95, 1.05)

    # Save to Excel
    df.to_excel(output_file, index=False)
    logger.info(f"✓ Created {len(df)} noon reports")


def run_calibration(excel_file: str = "data/noon_reports.xlsx"):
    """
    Run calibration example.

    Args:
        excel_file: Path to noon reports Excel file
    """
    logger.info("=" * 70)
    logger.info("WINDMAR - Performance Calibration Example")
    logger.info("=" * 70)
    logger.info("")

    excel_path = Path(excel_file)

    # Create sample data if file doesn't exist
    if not excel_path.exists():
        logger.info("Noon report file not found. Creating sample data...")
        excel_path.parent.mkdir(parents=True, exist_ok=True)
        create_sample_noon_reports(excel_path)
        logger.info("")

    # Step 1: Parse Excel noon reports
    logger.info("Step 1: Parsing noon reports from Excel...")
    try:
        parser = ExcelParser(excel_path)
        noon_reports = parser.parse()

        logger.info(f"✓ Parsed {len(noon_reports)} noon reports")

        # Display statistics
        stats = parser.get_statistics()
        logger.info(f"  Date range: {stats['date_range'][0].date()} to {stats['date_range'][1].date()}")
        logger.info(f"  Total distance: {stats.get('total_distance_nm', 0):.0f} nm")
        logger.info(f"  Total fuel: {stats.get('total_fuel_mt', 0):.1f} MT")
        logger.info(f"  Average daily fuel: {stats.get('avg_daily_fuel_mt', 0):.1f} MT")
        logger.info("")

    except Exception as e:
        logger.error(f"Failed to parse Excel file: {e}")
        return None

    # Step 2: Initialize calibrator
    logger.info("Step 2: Initializing model calibrator...")
    vessel_specs = VesselSpecs()
    calibrator = ModelCalibrator(vessel_specs=vessel_specs)
    logger.info(f"✓ Using vessel specs: {vessel_specs.dwt:.0f} DWT MR Tanker")
    logger.info("")

    # Step 3: Calibrate model
    logger.info("Step 3: Calibrating vessel performance model...")
    logger.info("  (This may take a minute...)")

    try:
        calibration_factors = calibrator.calibrate(
            noon_reports=noon_reports,
            initial_factors={
                "calm_water": 1.0,
                "wind": 1.0,
                "waves": 1.0,
            }
        )

        logger.info("✓ Calibration complete!")
        logger.info("")

    except Exception as e:
        logger.error(f"Calibration failed: {e}")
        return None

    # Step 4: Display calibration report
    logger.info("Step 4: Calibration Report")
    logger.info("")

    report = calibrator.get_calibration_report()
    print(report)

    # Step 5: Test predictions
    logger.info("\n" + "=" * 70)
    logger.info("Step 5: Testing Predictions")
    logger.info("=" * 70)
    logger.info("")

    # Test case 1: Laden, calm weather
    logger.info("Test Case 1: Laden, 14.5 knots, calm weather")
    pred1 = calibrator.predict_consumption(
        speed_kts=14.5,
        is_laden=True,
        weather=None,
        distance_nm=14.5 * 24,  # One day
    )
    logger.info(f"  Predicted fuel: {pred1['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power required: {pred1['power_kw']:.0f} kW ({pred1['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info("")

    # Test case 2: Laden, moderate weather
    logger.info("Test Case 2: Laden, 14.5 knots, moderate weather (BF 6, 3m waves)")
    pred2 = calibrator.predict_consumption(
        speed_kts=14.5,
        is_laden=True,
        weather={
            "wind_speed_ms": 12.0,  # ~24 knots
            "wind_dir_deg": 0,
            "heading_deg": 0,  # Head wind
            "sig_wave_height_m": 3.0,
            "wave_dir_deg": 0,
        },
        distance_nm=14.5 * 24,
    )
    logger.info(f"  Predicted fuel: {pred2['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power required: {pred2['power_kw']:.0f} kW ({pred2['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info(f"  Weather penalty: {pred2['fuel_mt'] - pred1['fuel_mt']:.2f} MT/day ({(pred2['fuel_mt']/pred1['fuel_mt']-1)*100:.1f}%)")
    logger.info("")

    # Test case 3: Ballast, calm weather
    logger.info("Test Case 3: Ballast, 15.0 knots, calm weather")
    pred3 = calibrator.predict_consumption(
        speed_kts=15.0,
        is_laden=False,
        weather=None,
        distance_nm=15.0 * 24,
    )
    logger.info(f"  Predicted fuel: {pred3['fuel_mt']:.2f} MT/day")
    logger.info(f"  Power required: {pred3['power_kw']:.0f} kW ({pred3['power_kw']/vessel_specs.mcr_kw*100:.1f}% MCR)")
    logger.info("")

    # Step 6: Save calibration results
    logger.info("Step 6: Saving calibration results...")

    results_file = Path("data/calibration_factors.txt")
    results_file.parent.mkdir(parents=True, exist_ok=True)

    with open(results_file, "w") as f:
        f.write(report)
        f.write("\n\n")
        f.write("Calibration Factors (JSON format):\n")
        f.write(str(calibration_factors))

    logger.info(f"✓ Saved calibration results to: {results_file}")
    logger.info("")

    logger.info("=" * 70)
    logger.info("✓ Calibration example completed successfully!")
    logger.info("=" * 70)
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Use calibrated factors in route optimization")
    logger.info("  2. Update vessel model with calibration factors")
    logger.info("  3. Monitor performance and recalibrate periodically")
    logger.info("")

    return calibrator


if __name__ == "__main__":
    try:
        result = run_calibration()
        sys.exit(0)
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)
        sys.exit(1)
