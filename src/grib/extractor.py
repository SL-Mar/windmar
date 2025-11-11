"""
GRIB Data Extractor for NOAA weather and wave forecasts.

Downloads GFS (weather) and WaveWatch III (wave) data from NOAA servers.
Supports point forecasts and route forecasts with file caching.
"""

import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from urllib.parse import urlencode

import requests


logger = logging.getLogger(__name__)


class GRIBExtractor:
    """
    Extracts GRIB data from NOAA sources.

    Supports:
    - GFS 0.25° resolution weather forecasts (384 hours)
    - WaveWatch III 0.5° wave forecasts (180 hours)
    - Point and bounding box extraction
    - File caching to minimize downloads
    """

    # NOAA data URLs
    GFS_BASE_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
    WAVE_BASE_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl"

    # GFS variables for maritime routing
    GFS_VARIABLES = [
        "UGRD",  # U-component of wind (m/s)
        "VGRD",  # V-component of wind (m/s)
        "PRMSL", # Pressure reduced to MSL (Pa)
        "PRATE", # Precipitation rate (kg/m²/s)
        "VIS",   # Visibility (m)
    ]

    # GFS pressure levels (surface, 10m)
    GFS_LEVELS = [
        "surface",
        "10_m_above_ground",
    ]

    # WaveWatch III variables
    WAVE_VARIABLES = [
        "HTSGW",  # Significant height of combined wind waves and swell (m)
        "PERPW",  # Primary wave mean period (s)
        "DIRPW",  # Primary wave direction (degrees)
        "WVHGT",  # Significant height of wind waves (m)
        "SWELL",  # Significant height of swell waves (m)
    ]

    def __init__(self, cache_dir: str = "data/grib_cache"):
        """
        Initialize GRIB extractor.

        Args:
            cache_dir: Directory to cache downloaded GRIB files
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def download_gfs_forecast(
        self,
        lat_range: Tuple[float, float],
        lon_range: Tuple[float, float],
        forecast_hours: int = 120,
        run_time: Optional[datetime] = None,
    ) -> Path:
        """
        Download GFS weather forecast for a bounding box.

        Args:
            lat_range: (lat_min, lat_max) in degrees
            lon_range: (lon_min, lon_max) in degrees (0-360 format)
            forecast_hours: Forecast length in hours (max 384)
            run_time: Model run time (defaults to latest available)

        Returns:
            Path to downloaded GRIB file

        Raises:
            requests.HTTPError: If download fails
        """
        if run_time is None:
            run_time = self._get_latest_gfs_run()

        # Generate cache filename
        cache_file = self._get_cache_filename(
            "gfs",
            run_time,
            lat_range,
            lon_range,
            forecast_hours,
        )

        # Return cached file if it exists
        if cache_file.exists():
            logger.info(f"Using cached GFS file: {cache_file}")
            return cache_file

        # Build download URL
        url = self._build_gfs_url(
            run_time,
            lat_range,
            lon_range,
            forecast_hours,
        )

        # Download file
        logger.info(f"Downloading GFS forecast from {run_time}")
        self._download_file(url, cache_file)

        return cache_file

    def download_wave_forecast(
        self,
        lat_range: Tuple[float, float],
        lon_range: Tuple[float, float],
        forecast_hours: int = 120,
        run_time: Optional[datetime] = None,
    ) -> Path:
        """
        Download WaveWatch III wave forecast for a bounding box.

        Args:
            lat_range: (lat_min, lat_max) in degrees
            lon_range: (lon_min, lon_max) in degrees (0-360 format)
            forecast_hours: Forecast length in hours (max 180)
            run_time: Model run time (defaults to latest available)

        Returns:
            Path to downloaded GRIB file

        Raises:
            requests.HTTPError: If download fails
        """
        if run_time is None:
            run_time = self._get_latest_wave_run()

        # Generate cache filename
        cache_file = self._get_cache_filename(
            "wave",
            run_time,
            lat_range,
            lon_range,
            forecast_hours,
        )

        # Return cached file if it exists
        if cache_file.exists():
            logger.info(f"Using cached wave file: {cache_file}")
            return cache_file

        # Build download URL
        url = self._build_wave_url(
            run_time,
            lat_range,
            lon_range,
            forecast_hours,
        )

        # Download file
        logger.info(f"Downloading wave forecast from {run_time}")
        self._download_file(url, cache_file)

        return cache_file

    def download_route_forecast(
        self,
        waypoints: List[Tuple[float, float]],
        forecast_hours: int = 120,
        buffer_degrees: float = 2.0,
    ) -> Tuple[Path, Path]:
        """
        Download GFS and wave forecasts for a route.

        Creates a bounding box around the route with buffer.

        Args:
            waypoints: List of (lat, lon) waypoints
            forecast_hours: Forecast length in hours
            buffer_degrees: Buffer around route in degrees

        Returns:
            Tuple of (gfs_file, wave_file) paths
        """
        # Calculate bounding box
        lats = [wp[0] for wp in waypoints]
        lons = [wp[1] for wp in waypoints]

        lat_min = max(-90, min(lats) - buffer_degrees)
        lat_max = min(90, max(lats) + buffer_degrees)
        lon_min = min(lons) - buffer_degrees
        lon_max = max(lons) + buffer_degrees

        # Convert to 0-360 format if needed
        if lon_min < 0:
            lon_min += 360
        if lon_max < 0:
            lon_max += 360

        logger.info(
            f"Downloading forecasts for route: "
            f"lat [{lat_min:.1f}, {lat_max:.1f}], "
            f"lon [{lon_min:.1f}, {lon_max:.1f}]"
        )

        # Download both forecasts
        gfs_file = self.download_gfs_forecast(
            (lat_min, lat_max),
            (lon_min, lon_max),
            forecast_hours,
        )

        wave_file = self.download_wave_forecast(
            (lat_min, lat_max),
            (lon_min, lon_max),
            min(forecast_hours, 180),  # Wave max is 180 hours
        )

        return gfs_file, wave_file

    def _build_gfs_url(
        self,
        run_time: datetime,
        lat_range: Tuple[float, float],
        lon_range: Tuple[float, float],
        forecast_hours: int,
    ) -> str:
        """Build GFS download URL with filters."""
        # Format: gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.fFFF
        date_str = run_time.strftime("%Y%m%d")
        hour_str = run_time.strftime("%H")

        # Build parameter dictionary
        params = {
            "file": f"gfs.t{hour_str}z.pgrb2.0p25.f000",
            "dir": f"/gfs.{date_str}/{hour_str}/atmos",
        }

        # Add bounding box
        params["subregion"] = ""
        params["toplat"] = str(lat_range[1])
        params["leftlon"] = str(lon_range[0])
        params["rightlon"] = str(lon_range[1])
        params["bottomlat"] = str(lat_range[0])

        # Add variables
        for var in self.GFS_VARIABLES:
            params[f"var_{var}"] = "on"

        # Add levels
        for level in self.GFS_LEVELS:
            params[f"lev_{level}"] = "on"

        # Add forecast hours (every 3 hours)
        for hour in range(0, min(forecast_hours + 1, 385), 3):
            params[f"all_{hour:03d}"] = "on"

        return f"{self.GFS_BASE_URL}?{urlencode(params)}"

    def _build_wave_url(
        self,
        run_time: datetime,
        lat_range: Tuple[float, float],
        lon_range: Tuple[float, float],
        forecast_hours: int,
    ) -> str:
        """Build WaveWatch III download URL with filters."""
        date_str = run_time.strftime("%Y%m%d")
        hour_str = run_time.strftime("%H")

        params = {
            "file": f"gfswave.t{hour_str}z.global.0p25.f000.grib2",
            "dir": f"/gfs.{date_str}/{hour_str}/wave/gridded",
        }

        # Add bounding box
        params["subregion"] = ""
        params["toplat"] = str(lat_range[1])
        params["leftlon"] = str(lon_range[0])
        params["rightlon"] = str(lon_range[1])
        params["bottomlat"] = str(lat_range[0])

        # Add variables
        for var in self.WAVE_VARIABLES:
            params[f"var_{var}"] = "on"

        # Add forecast hours (every 3 hours)
        for hour in range(0, min(forecast_hours + 1, 181), 3):
            params[f"all_{hour:03d}"] = "on"

        return f"{self.WAVE_BASE_URL}?{urlencode(params)}"

    def _download_file(self, url: str, output_path: Path) -> None:
        """Download file from URL with progress logging."""
        try:
            response = requests.get(url, stream=True, timeout=300)
            response.raise_for_status()

            # Write to file
            with open(output_path, "wb") as f:
                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            logger.debug(f"Download progress: {percent:.1f}%")

            logger.info(f"Downloaded {downloaded / 1024 / 1024:.1f} MB to {output_path}")

        except requests.RequestException as e:
            logger.error(f"Failed to download {url}: {e}")
            if output_path.exists():
                output_path.unlink()  # Clean up partial download
            raise

    def _get_cache_filename(
        self,
        data_type: str,
        run_time: datetime,
        lat_range: Tuple[float, float],
        lon_range: Tuple[float, float],
        forecast_hours: int,
    ) -> Path:
        """Generate cache filename based on parameters."""
        filename = (
            f"{data_type}_"
            f"{run_time.strftime('%Y%m%d_%H')}_"
            f"lat{lat_range[0]:.1f}_{lat_range[1]:.1f}_"
            f"lon{lon_range[0]:.1f}_{lon_range[1]:.1f}_"
            f"f{forecast_hours:03d}.grb2"
        )
        return self.cache_dir / filename

    def _get_latest_gfs_run(self) -> datetime:
        """Get the latest available GFS run time."""
        # GFS runs at 00, 06, 12, 18 UTC
        # Available ~4 hours after run time
        now = datetime.utcnow()
        run_hour = (now.hour // 6) * 6
        latest_run = now.replace(hour=run_hour, minute=0, second=0, microsecond=0)

        # Go back one run if current run might not be ready
        if now.hour % 6 < 4:
            latest_run -= timedelta(hours=6)

        return latest_run

    def _get_latest_wave_run(self) -> datetime:
        """Get the latest available WaveWatch III run time."""
        # Same schedule as GFS
        return self._get_latest_gfs_run()

    def clear_cache(self, older_than_days: int = 7) -> int:
        """
        Clear old cached GRIB files.

        Args:
            older_than_days: Delete files older than this many days

        Returns:
            Number of files deleted
        """
        cutoff_time = datetime.now() - timedelta(days=older_than_days)
        deleted_count = 0

        for file_path in self.cache_dir.glob("*.grb2"):
            if file_path.stat().st_mtime < cutoff_time.timestamp():
                file_path.unlink()
                deleted_count += 1
                logger.info(f"Deleted old cache file: {file_path}")

        return deleted_count
