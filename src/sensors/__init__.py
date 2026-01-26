"""Sensor interfaces for real-time vessel monitoring."""

from .sbg_nmea import SBGNmeaParser, ShipMotionData, AttitudeData, IMUData, SBGSimulator
from .wave_estimator import WaveEstimator, WaveEstimate

# Extended SBG integration with multiple connection types
from .sbg_ellipse import (
    SBGEllipseN,
    SBGData,
    ConnectionType,
    NMEAParser,
    SBGSimulator as SBGEllipseSimulator,
)

# Time-series data storage
from .timeseries import (
    SensorDataStore,
    TimeSeriesPoint,
    TimeSeriesBuffer,
)

__all__ = [
    # NMEA parser
    "SBGNmeaParser",
    "ShipMotionData",
    "AttitudeData",
    "IMUData",
    "SBGSimulator",
    # Wave estimation
    "WaveEstimator",
    "WaveEstimate",
    # Extended SBG (serial/TCP/UDP)
    "SBGEllipseN",
    "SBGData",
    "ConnectionType",
    "NMEAParser",
    "SBGEllipseSimulator",
    # Time-series storage
    "SensorDataStore",
    "TimeSeriesPoint",
    "TimeSeriesBuffer",
]
