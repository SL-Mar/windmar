"""
Vessel fuel consumption model for MR Product Tanker.

Implements physics-based model using:
- Holtrop-Mennen resistance prediction
- SFOC curves for main engine
- Weather effects (wind, waves)
- Laden vs ballast conditions
"""

import logging
from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np


logger = logging.getLogger(__name__)


@dataclass
class VesselSpecs:
    """Vessel specifications for MR Product Tanker."""

    # Dimensions
    loa: float = 183.0  # Length overall (m)
    lpp: float = 176.0  # Length between perpendiculars (m)
    beam: float = 32.0  # Beam (m)
    draft_laden: float = 11.8  # Draft laden (m)
    draft_ballast: float = 6.5  # Draft ballast (m)
    dwt: float = 49000.0  # Deadweight tonnage (MT)
    displacement_laden: float = 65000.0  # Displacement laden (MT)
    displacement_ballast: float = 20000.0  # Displacement ballast (MT)

    # Block coefficient estimates
    cb_laden: float = 0.82  # Block coefficient laden
    cb_ballast: float = 0.75  # Block coefficient ballast

    # Wetted surface area (m²)
    wetted_surface_laden: float = 7500.0
    wetted_surface_ballast: float = 5200.0

    # Main engine
    mcr_kw: float = 8840.0  # Maximum continuous rating (kW)
    sfoc_at_mcr: float = 171.0  # Specific fuel oil consumption at MCR (g/kWh)

    # Service speeds
    service_speed_laden: float = 14.5  # Service speed laden (knots)
    service_speed_ballast: float = 15.0  # Service speed ballast (knots)

    # Frontal area for wind resistance
    frontal_area_laden: float = 450.0  # Above water frontal area laden (m²)
    frontal_area_ballast: float = 850.0  # Above water frontal area ballast (m²)

    # Lateral area for drift
    lateral_area_laden: float = 2100.0  # Lateral area laden (m²)
    lateral_area_ballast: float = 2800.0  # Lateral area ballast (m²)


class VesselModel:
    """
    Fuel consumption model for MR Product Tanker.

    Calculates fuel consumption based on vessel specs, speed,
    loading condition, and weather conditions.
    """

    # Seawater properties
    RHO_SW = 1025.0  # Seawater density (kg/m³)
    NU_SW = 1.19e-6  # Kinematic viscosity (m²/s at 15°C)

    # Air properties
    RHO_AIR = 1.225  # Air density (kg/m³)

    # Propulsion efficiency
    PROP_EFFICIENCY = 0.65  # Propeller efficiency
    HULL_EFFICIENCY = 1.05  # Hull efficiency factor
    RELATIVE_ROTATIVE_EFF = 1.00  # Relative rotative efficiency

    def __init__(
        self,
        specs: Optional[VesselSpecs] = None,
        calibration_factors: Optional[Dict[str, float]] = None,
    ):
        """
        Initialize vessel model.

        Args:
            specs: Vessel specifications (defaults to MR tanker)
            calibration_factors: Optional calibration factors from noon reports
        """
        self.specs = specs or VesselSpecs()
        self.calibration_factors = calibration_factors or {
            "calm_water": 1.0,
            "wind": 1.0,
            "waves": 1.0,
        }

    def calculate_fuel_consumption(
        self,
        speed_kts: float,
        is_laden: bool,
        weather: Optional[Dict[str, float]] = None,
        distance_nm: float = 1.0,
    ) -> Dict[str, float]:
        """
        Calculate fuel consumption for a voyage segment.

        Args:
            speed_kts: Vessel speed through water (knots)
            is_laden: True if laden, False if ballast
            weather: Weather conditions dict (wind_speed_ms, wind_dir_deg,
                     sig_wave_height_m, wave_dir_deg, heading_deg)
            distance_nm: Distance traveled (nautical miles)

        Returns:
            Dictionary with:
                - fuel_mt: Total fuel consumed (metric tons)
                - power_kw: Engine power required (kW)
                - time_hours: Time taken (hours)
                - fuel_breakdown: Breakdown by component
        """
        # Convert speed to m/s
        speed_ms = speed_kts * 0.51444

        # Get vessel parameters for loading condition
        draft = self.specs.draft_laden if is_laden else self.specs.draft_ballast
        displacement = (
            self.specs.displacement_laden if is_laden
            else self.specs.displacement_ballast
        )
        cb = self.specs.cb_laden if is_laden else self.specs.cb_ballast
        wetted_surface = (
            self.specs.wetted_surface_laden if is_laden
            else self.specs.wetted_surface_ballast
        )

        # Calculate calm water resistance
        resistance_calm = self._holtrop_mennen_resistance(
            speed_ms, draft, displacement, cb, wetted_surface
        )

        # Add wind resistance
        resistance_wind = 0.0
        if weather and "wind_speed_ms" in weather:
            resistance_wind = self._wind_resistance(
                weather["wind_speed_ms"],
                weather.get("wind_dir_deg", 0),
                weather.get("heading_deg", 0),
                is_laden,
            )

        # Add wave resistance
        resistance_waves = 0.0
        if weather and "sig_wave_height_m" in weather:
            resistance_waves = self._wave_resistance(
                weather["sig_wave_height_m"],
                weather.get("wave_dir_deg", 0),
                weather.get("heading_deg", 0),
                speed_ms,
                is_laden,
            )

        # Total resistance
        total_resistance = (
            resistance_calm * self.calibration_factors["calm_water"]
            + resistance_wind * self.calibration_factors["wind"]
            + resistance_waves * self.calibration_factors["waves"]
        )

        # Calculate required power
        tow_power_kw = (total_resistance * speed_ms) / 1000.0  # kW

        # Account for propulsion efficiencies
        brake_power_kw = tow_power_kw / (
            self.PROP_EFFICIENCY
            * self.HULL_EFFICIENCY
            * self.RELATIVE_ROTATIVE_EFF
        )

        # Ensure power is within engine limits
        brake_power_kw = min(brake_power_kw, self.specs.mcr_kw)

        # Calculate SFOC at this load
        load_fraction = brake_power_kw / self.specs.mcr_kw
        sfoc = self._sfoc_curve(load_fraction)

        # Calculate time and fuel
        time_hours = distance_nm / speed_kts
        # SFOC is in g/kWh, so result is in grams
        fuel_grams = brake_power_kw * sfoc * time_hours
        fuel_mt = fuel_grams / 1_000_000.0  # grams to metric tons

        return {
            "fuel_mt": fuel_mt,
            "power_kw": brake_power_kw,
            "time_hours": time_hours,
            "fuel_breakdown": {
                "calm_water": (resistance_calm / total_resistance) * fuel_mt
                if total_resistance > 0
                else fuel_mt,
                "wind": (resistance_wind / total_resistance) * fuel_mt
                if total_resistance > 0
                else 0.0,
                "waves": (resistance_waves / total_resistance) * fuel_mt
                if total_resistance > 0
                else 0.0,
            },
            "resistance_breakdown_kn": {
                "calm_water": resistance_calm / 1000.0,
                "wind": resistance_wind / 1000.0,
                "waves": resistance_waves / 1000.0,
                "total": total_resistance / 1000.0,
            },
        }

    def _holtrop_mennen_resistance(
        self,
        speed_ms: float,
        draft: float,
        displacement: float,
        cb: float,
        wetted_surface: float,
    ) -> float:
        """
        Calculate calm water resistance using Holtrop-Mennen method.

        Simplified version for tankers.

        Args:
            speed_ms: Speed (m/s)
            draft: Draft (m)
            displacement: Displacement (MT)
            cb: Block coefficient
            wetted_surface: Wetted surface area (m²)

        Returns:
            Total resistance (N)
        """
        # Calculate Froude number
        froude = speed_ms / np.sqrt(9.81 * self.specs.lpp)

        # Calculate Reynolds number
        reynolds = speed_ms * self.specs.lpp / self.NU_SW

        # Frictional resistance coefficient (ITTC 1957)
        cf = 0.075 / (np.log10(reynolds) - 2) ** 2

        # Form factor (Holtrop-Mennen for tankers)
        lcb_fraction = -3.0  # LCB as % of Lpp (typical for tanker)
        k1 = (
            0.93
            + 0.4871 * (self.specs.beam / self.specs.lpp)
            - 0.2156 * (self.specs.beam / draft)
            + 0.1027 * cb
        )

        # Frictional resistance
        rf = 0.5 * self.RHO_SW * speed_ms**2 * wetted_surface * cf * (1 + k1)

        # Wave-making resistance (simplified)
        # For tankers at typical Froude numbers
        c1 = 2223105 * cb**3.78613 * (draft / self.specs.beam) ** 1.07961
        c7 = 0.229577 * (self.specs.beam / self.specs.lpp) ** 0.33333

        if froude < 0.4:
            rw = (
                c1
                * c7
                * displacement
                * self.RHO_SW
                * 9.81
                * np.exp(-0.4 * froude**-2)
            )
        else:
            rw = 0.0  # Minimal at high Froude numbers

        # Appendage resistance (rudder, etc.) - estimate 5% of frictional
        rapp = 0.05 * rf

        # Total resistance
        total_resistance = rf + rw + rapp

        return total_resistance

    def _wind_resistance(
        self,
        wind_speed_ms: float,
        wind_dir_deg: float,
        heading_deg: float,
        is_laden: bool,
    ) -> float:
        """
        Calculate wind resistance.

        Uses Blendermann method for wind forces.

        Args:
            wind_speed_ms: True wind speed (m/s)
            wind_dir_deg: True wind direction (degrees)
            heading_deg: Vessel heading (degrees)
            is_laden: Loading condition

        Returns:
            Wind resistance (N)
        """
        # Calculate relative wind angle
        relative_angle = abs(((wind_dir_deg - heading_deg) + 180) % 360 - 180)
        relative_angle_rad = np.radians(relative_angle)

        # Select frontal and lateral areas
        frontal_area = (
            self.specs.frontal_area_laden if is_laden
            else self.specs.frontal_area_ballast
        )
        lateral_area = (
            self.specs.lateral_area_laden if is_laden
            else self.specs.lateral_area_ballast
        )

        # Wind force coefficients (simplified Blendermann)
        # Longitudinal coefficient
        cx = (
            -0.6 * np.cos(relative_angle_rad)
            + 0.8 * np.cos(relative_angle_rad) ** 2
        )

        # Transverse coefficient (contributes to resistance through drift)
        cy = 0.9 * np.sin(relative_angle_rad)

        # Calculate forces
        fx = (
            0.5
            * self.RHO_AIR
            * wind_speed_ms**2
            * frontal_area
            * abs(cx)
        )
        fy = 0.5 * self.RHO_AIR * wind_speed_ms**2 * lateral_area * abs(cy)

        # Total wind resistance (longitudinal + drift component)
        # Drift angle typically small, so use simplified approach
        wind_resistance = fx + 0.1 * fy  # 10% of transverse force contributes

        return wind_resistance

    def _wave_resistance(
        self,
        sig_wave_height_m: float,
        wave_dir_deg: float,
        heading_deg: float,
        speed_ms: float,
        is_laden: bool,
    ) -> float:
        """
        Calculate added resistance in waves.

        Uses empirical correlation based on wave height and relative direction.

        Args:
            sig_wave_height_m: Significant wave height (m)
            wave_dir_deg: Wave direction (degrees)
            heading_deg: Vessel heading (degrees)
            speed_ms: Vessel speed (m/s)
            is_laden: Loading condition

        Returns:
            Added wave resistance (N)
        """
        # Calculate relative wave angle
        relative_angle = abs(((wave_dir_deg - heading_deg) + 180) % 360 - 180)
        relative_angle_rad = np.radians(relative_angle)

        # Directional factor (head seas worst, following seas minimal)
        directional_factor = (1 + np.cos(relative_angle_rad)) / 2

        # Wave resistance coefficient (empirical for tankers)
        # Based on Kwon (2008) simplified correlation
        draft = self.specs.draft_laden if is_laden else self.specs.draft_ballast
        froude = speed_ms / np.sqrt(9.81 * self.specs.lpp)

        # Simplified empirical formula
        raw = (
            directional_factor
            * 4.5
            * self.RHO_SW
            * 9.81
            * self.specs.beam
            * (sig_wave_height_m**2)
            * (1 + froude)
        )

        return raw

    def _sfoc_curve(self, load_fraction: float) -> float:
        """
        Calculate specific fuel oil consumption at given load.

        Uses typical 2-stroke diesel SFOC curve.

        Args:
            load_fraction: Engine load as fraction of MCR (0-1)

        Returns:
            SFOC in g/kWh
        """
        # Ensure load is within reasonable range
        load_fraction = max(0.15, min(1.0, load_fraction))

        # Typical SFOC curve for modern 2-stroke diesel
        # SFOC is optimal around 75-85% load
        if load_fraction < 0.75:
            # Below optimal load, SFOC increases
            sfoc = self.specs.sfoc_at_mcr * (1.0 + 0.15 * (0.75 - load_fraction))
        else:
            # At and above optimal load
            sfoc = self.specs.sfoc_at_mcr * (1.0 + 0.05 * (load_fraction - 0.75))

        return sfoc

    def get_optimal_speed(
        self,
        is_laden: bool,
        weather: Optional[Dict[str, float]] = None,
    ) -> float:
        """
        Calculate optimal speed for fuel efficiency.

        Args:
            is_laden: Loading condition
            weather: Weather conditions

        Returns:
            Optimal speed in knots
        """
        # Test speeds around service speed
        service_speed = (
            self.specs.service_speed_laden if is_laden
            else self.specs.service_speed_ballast
        )

        speeds = np.linspace(service_speed - 3, service_speed + 2, 20)
        fuel_rates = []

        for speed in speeds:
            result = self.calculate_fuel_consumption(
                speed, is_laden, weather, distance_nm=1.0
            )
            fuel_per_nm = result["fuel_mt"] / 1.0
            fuel_rates.append(fuel_per_nm)

        # Find minimum fuel per mile
        optimal_idx = np.argmin(fuel_rates)
        return float(speeds[optimal_idx])
