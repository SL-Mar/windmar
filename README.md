# WINDMAR - Maritime Route Optimizer for MR Product Tanker

A Python-based route optimization system for Medium Range (MR) Product Tankers that minimizes fuel consumption using real-time weather and wave data from NOAA.

## Features

- **GRIB Data Integration**: Automatic download and parsing of NOAA GFS (weather) and WaveWatch III (waves) forecasts
- **Vessel Performance Model**: Physics-based fuel consumption model using Holtrop-Mennen resistance and SFOC curves
- **Route Optimization**: A* pathfinding algorithm adapted for maritime navigation
- **Weather Visualization**: Interactive weather maps with route overlays using Cartopy
- **Model Calibration**: Calibrate performance models from Excel noon report data
- **Constraint Handling**: Under Keel Clearance (UKC), ECA zones, weather limits

## Vessel Specifications

The system is optimized for a typical MR Product Tanker:
- **DWT**: 49,000 MT
- **LOA**: 183m, Beam: 32m
- **Draft**: 11.8m (laden), 6.5m (ballast)
- **Main Engine**: 8,840 kW
- **SFOC**: 171 g/kWh at MCR
- **Service Speed**: 14.5 kts (laden), 15.0 kts (ballast)

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

### 1. Optimize a Route (Rotterdam to Augusta)

```python
from examples.example_ara_med import run_ara_med_optimization

# Optimize ARA-MED route
result = run_ara_med_optimization()
print(f"Optimized fuel consumption: {result['fuel_mt']:.1f} MT")
```

### 2. Calibrate from Noon Reports

```python
from examples.example_calibration import run_calibration

# Calibrate model from Excel noon reports
calibration_results = run_calibration('data/noon_reports.xlsx')
```

## Project Structure

```
windmar/
├── src/
│   ├── grib/
│   │   ├── extractor.py    # Download GRIB files from NOAA
│   │   └── parser.py        # Parse GRIB data with pygrib
│   ├── visualization/
│   │   └── plotter.py       # Weather maps and route visualization
│   ├── optimization/
│   │   ├── vessel_model.py  # Fuel consumption model
│   │   └── router.py        # A* route optimization
│   └── database/
│       ├── excel_parser.py  # Parse Excel noon reports
│       └── calibration.py   # Calibrate model from data
├── examples/
│   ├── example_ara_med.py        # Rotterdam-Augusta example
│   └── example_calibration.py    # Calibration example
├── tests/
│   ├── unit/
│   └── integration/
└── data/
    └── grib_cache/          # Downloaded GRIB files

```

## Data Sources

- **Weather Forecasts**: NOAA GFS (0.25° resolution, 384-hour forecast)
- **Wave Forecasts**: NOAA WaveWatch III (0.5° resolution, 180-hour forecast)

Both datasets are freely available and updated every 6 hours.

## License

Private - SL Mar

## Author

SL Mar - Maritime Route Optimization Team
