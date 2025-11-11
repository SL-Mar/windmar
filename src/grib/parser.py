"""
GRIB Parser for extracting weather and wave data.

Uses pygrib to parse GRIB2 files and extract meteorological and
oceanographic data at specific locations and times.
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.interpolate import RegularGridInterpolator


logger = logging.getLogger(__name__)


class GRIBParser:
    """
    Parser for GRIB weather and wave files.

    Extracts and interpolates meteorological and oceanographic data
    from NOAA GRIB2 files.
    """

    def __init__(self, grib_file: Path):
        """
        Initialize GRIB parser.

        Args:
            grib_file: Path to GRIB2 file

        Raises:
            FileNotFoundError: If GRIB file doesn't exist
            ImportError: If pygrib is not installed
        """
        if not grib_file.exists():
            raise FileNotFoundError(f"GRIB file not found: {grib_file}")

        self.grib_file = grib_file
        self._data_cache: Dict[str, np.ndarray] = {}
        self._grid_cache: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self._forecast_times: Optional[List[datetime]] = None

        # Try to import pygrib
        try:
            import pygrib
            self.pygrib = pygrib
        except ImportError:
            logger.error(
                "pygrib not installed. Install with: pip install pygrib"
            )
            raise

    def get_weather_at_point(
        self,
        lat: float,
        lon: float,
        forecast_time: datetime,
    ) -> Dict[str, float]:
        """
        Get weather data at a specific point and time.

        Args:
            lat: Latitude in degrees (-90 to 90)
            lon: Longitude in degrees (-180 to 180)
            forecast_time: Forecast valid time

        Returns:
            Dictionary with weather parameters:
                - wind_speed_ms: Wind speed (m/s)
                - wind_dir_deg: Wind direction (degrees, meteorological)
                - pressure_pa: Sea level pressure (Pa)
                - precip_rate: Precipitation rate (mm/hr)
                - visibility_m: Visibility (m)
        """
        # Normalize longitude to 0-360
        lon_360 = lon if lon >= 0 else lon + 360

        # Extract variables
        u_wind = self._get_value_at_point("UGRD", lat, lon_360, forecast_time)
        v_wind = self._get_value_at_point("VGRD", lat, lon_360, forecast_time)
        pressure = self._get_value_at_point("PRMSL", lat, lon_360, forecast_time)

        # Calculate wind speed and direction
        wind_speed = np.sqrt(u_wind**2 + v_wind**2)
        wind_dir = (np.degrees(np.arctan2(-u_wind, -v_wind)) + 360) % 360

        result = {
            "wind_speed_ms": float(wind_speed),
            "wind_dir_deg": float(wind_dir),
            "pressure_pa": float(pressure) if pressure else None,
        }

        # Optional variables (may not be in all GRIB files)
        try:
            precip = self._get_value_at_point("PRATE", lat, lon_360, forecast_time)
            result["precip_rate"] = float(precip * 3600) if precip else 0.0  # Convert to mm/hr
        except Exception:
            result["precip_rate"] = 0.0

        try:
            visibility = self._get_value_at_point("VIS", lat, lon_360, forecast_time)
            result["visibility_m"] = float(visibility) if visibility else None
        except Exception:
            result["visibility_m"] = None

        return result

    def get_waves_at_point(
        self,
        lat: float,
        lon: float,
        forecast_time: datetime,
    ) -> Dict[str, float]:
        """
        Get wave data at a specific point and time.

        Args:
            lat: Latitude in degrees (-90 to 90)
            lon: Longitude in degrees (-180 to 180)
            forecast_time: Forecast valid time

        Returns:
            Dictionary with wave parameters:
                - sig_wave_height_m: Significant wave height (m)
                - wave_period_s: Primary wave period (s)
                - wave_dir_deg: Primary wave direction (degrees)
                - wind_wave_height_m: Wind wave height (m)
                - swell_height_m: Swell height (m)
        """
        lon_360 = lon if lon >= 0 else lon + 360

        # Extract wave variables
        sig_height = self._get_value_at_point("HTSGW", lat, lon_360, forecast_time)
        period = self._get_value_at_point("PERPW", lat, lon_360, forecast_time)
        direction = self._get_value_at_point("DIRPW", lat, lon_360, forecast_time)

        result = {
            "sig_wave_height_m": float(sig_height) if sig_height else 0.0,
            "wave_period_s": float(period) if period else 0.0,
            "wave_dir_deg": float(direction) if direction else 0.0,
        }

        # Optional components
        try:
            wind_wave = self._get_value_at_point("WVHGT", lat, lon_360, forecast_time)
            result["wind_wave_height_m"] = float(wind_wave) if wind_wave else 0.0
        except Exception:
            result["wind_wave_height_m"] = 0.0

        try:
            swell = self._get_value_at_point("SWELL", lat, lon_360, forecast_time)
            result["swell_height_m"] = float(swell) if swell else 0.0
        except Exception:
            result["swell_height_m"] = 0.0

        return result

    def get_forecast_times(self) -> List[datetime]:
        """
        Get list of available forecast times in the GRIB file.

        Returns:
            List of datetime objects for each forecast time
        """
        if self._forecast_times is not None:
            return self._forecast_times

        with self.pygrib.open(str(self.grib_file)) as grbs:
            times = set()
            for grb in grbs:
                valid_time = grb.validDate
                times.add(valid_time)

        self._forecast_times = sorted(list(times))
        return self._forecast_times

    def get_grid_data(
        self,
        variable: str,
        forecast_time: datetime,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Get full grid data for a variable at a specific time.

        Useful for visualization.

        Args:
            variable: Variable name (e.g., "UGRD", "HTSGW")
            forecast_time: Forecast valid time

        Returns:
            Tuple of (lats, lons, values) as 2D numpy arrays
        """
        with self.pygrib.open(str(self.grib_file)) as grbs:
            # Find matching message
            for grb in grbs:
                if grb.shortName == variable and grb.validDate == forecast_time:
                    lats, lons = grb.latlons()
                    values = grb.values
                    return lats, lons, values

        raise ValueError(
            f"Variable {variable} not found for time {forecast_time}"
        )

    def _get_value_at_point(
        self,
        variable: str,
        lat: float,
        lon: float,
        forecast_time: datetime,
    ) -> Optional[float]:
        """
        Extract and interpolate value at a specific point.

        Uses bilinear interpolation for smooth values.

        Args:
            variable: Variable short name
            lat: Latitude in degrees
            lon: Longitude in degrees (0-360)
            forecast_time: Forecast valid time

        Returns:
            Interpolated value or None if not found
        """
        cache_key = f"{variable}_{forecast_time.isoformat()}"

        # Check cache
        if cache_key not in self._data_cache:
            # Load data from GRIB
            try:
                with self.pygrib.open(str(self.grib_file)) as grbs:
                    for grb in grbs:
                        if (
                            grb.shortName == variable
                            and grb.validDate == forecast_time
                        ):
                            # Get grid and values
                            if self._grid_cache is None:
                                lats, lons = grb.latlons()
                                # Get unique sorted coordinates
                                lat_1d = lats[:, 0]
                                lon_1d = lons[0, :]
                                self._grid_cache = (lat_1d, lon_1d)
                            else:
                                lat_1d, lon_1d = self._grid_cache

                            values = grb.values
                            self._data_cache[cache_key] = (lat_1d, lon_1d, values)
                            break
                    else:
                        logger.warning(
                            f"Variable {variable} not found for {forecast_time}"
                        )
                        return None
            except Exception as e:
                logger.error(f"Error reading GRIB file: {e}")
                return None

        # Interpolate
        if cache_key in self._data_cache:
            lat_1d, lon_1d, values = self._data_cache[cache_key]

            try:
                # Create interpolator (only if grid is regular)
                # Note: NOAA GRIB files are on regular lat/lon grids
                interpolator = RegularGridInterpolator(
                    (lat_1d, lon_1d),
                    values,
                    method="linear",
                    bounds_error=False,
                    fill_value=None,
                )

                # Interpolate at point
                result = interpolator([lat, lon])
                return float(result[0]) if not np.isnan(result[0]) else None

            except Exception as e:
                logger.error(f"Interpolation error: {e}")
                return None

        return None

    def get_time_series(
        self,
        lat: float,
        lon: float,
        variable: str,
    ) -> List[Tuple[datetime, float]]:
        """
        Get time series of a variable at a point.

        Args:
            lat: Latitude in degrees
            lon: Longitude in degrees
            variable: Variable short name

        Returns:
            List of (datetime, value) tuples
        """
        forecast_times = self.get_forecast_times()
        lon_360 = lon if lon >= 0 else lon + 360

        time_series = []
        for forecast_time in forecast_times:
            value = self._get_value_at_point(variable, lat, lon_360, forecast_time)
            if value is not None:
                time_series.append((forecast_time, value))

        return time_series

    def clear_cache(self) -> None:
        """Clear internal data cache."""
        self._data_cache.clear()
        self._grid_cache = None
        logger.debug("Cleared GRIB parser cache")
