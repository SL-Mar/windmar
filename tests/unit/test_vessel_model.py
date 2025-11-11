"""Unit tests for vessel performance model."""

import pytest
import numpy as np

from src.optimization.vessel_model import VesselModel, VesselSpecs


class TestVesselSpecs:
    """Test VesselSpecs dataclass."""

    def test_default_specs(self):
        """Test default MR tanker specifications."""
        specs = VesselSpecs()

        assert specs.dwt == 49000.0
        assert specs.loa == 183.0
        assert specs.beam == 32.0
        assert specs.draft_laden > specs.draft_ballast
        assert specs.mcr_kw == 8840.0
        assert specs.sfoc_at_mcr == 171.0


class TestVesselModel:
    """Test VesselModel fuel consumption calculations."""

    @pytest.fixture
    def vessel_model(self):
        """Create vessel model instance."""
        return VesselModel()

    def test_initialization(self, vessel_model):
        """Test model initialization."""
        assert vessel_model.specs.dwt == 49000.0
        assert vessel_model.calibration_factors["calm_water"] == 1.0

    def test_calm_water_fuel_consumption_laden(self, vessel_model):
        """Test calm water fuel consumption for laden condition."""
        result = vessel_model.calculate_fuel_consumption(
            speed_kts=14.5,
            is_laden=True,
            weather=None,
            distance_nm=348.0,  # One day at 14.5 kts
        )

        # Check result structure
        assert "fuel_mt" in result
        assert "power_kw" in result
        assert "time_hours" in result
        assert "fuel_breakdown" in result

        # Sanity checks
        assert result["fuel_mt"] > 0
        assert result["fuel_mt"] < 100  # Reasonable daily consumption
        assert result["power_kw"] > 0
        assert result["power_kw"] <= vessel_model.specs.mcr_kw
        assert result["time_hours"] == pytest.approx(24.0, rel=0.1)

    def test_calm_water_fuel_consumption_ballast(self, vessel_model):
        """Test calm water fuel consumption for ballast condition."""
        result = vessel_model.calculate_fuel_consumption(
            speed_kts=15.0,
            is_laden=False,
            weather=None,
            distance_nm=360.0,
        )

        assert result["fuel_mt"] > 0
        assert result["fuel_mt"] < 100

    def test_fuel_increases_with_speed(self, vessel_model):
        """Test that fuel consumption increases with speed."""
        speeds = [12.0, 14.0, 16.0]
        fuels = []

        for speed in speeds:
            result = vessel_model.calculate_fuel_consumption(
                speed_kts=speed,
                is_laden=True,
                weather=None,
                distance_nm=speed * 24,
            )
            fuels.append(result["fuel_mt"])

        # Fuel should increase with speed
        assert fuels[1] > fuels[0]
        assert fuels[2] > fuels[1]

    def test_laden_uses_more_fuel_than_ballast(self, vessel_model):
        """Test that laden condition uses more fuel than ballast."""
        speed = 14.5
        distance = speed * 24

        laden = vessel_model.calculate_fuel_consumption(
            speed_kts=speed,
            is_laden=True,
            weather=None,
            distance_nm=distance,
        )

        ballast = vessel_model.calculate_fuel_consumption(
            speed_kts=speed,
            is_laden=False,
            weather=None,
            distance_nm=distance,
        )

        assert laden["fuel_mt"] > ballast["fuel_mt"]

    def test_weather_impact(self, vessel_model):
        """Test that weather increases fuel consumption."""
        speed = 14.5
        distance = speed * 24

        # Calm weather
        calm = vessel_model.calculate_fuel_consumption(
            speed_kts=speed,
            is_laden=True,
            weather=None,
            distance_nm=distance,
        )

        # Bad weather (head wind and waves)
        bad_weather = vessel_model.calculate_fuel_consumption(
            speed_kts=speed,
            is_laden=True,
            weather={
                "wind_speed_ms": 15.0,
                "wind_dir_deg": 0,
                "heading_deg": 0,  # Head wind
                "sig_wave_height_m": 3.0,
                "wave_dir_deg": 0,
            },
            distance_nm=distance,
        )

        # Bad weather should use more fuel
        assert bad_weather["fuel_mt"] > calm["fuel_mt"]
        assert bad_weather["power_kw"] > calm["power_kw"]

    def test_sfoc_curve(self, vessel_model):
        """Test SFOC curve behavior."""
        # Test at different loads
        loads = [0.5, 0.75, 1.0]
        sfocs = [vessel_model._sfoc_curve(load) for load in loads]

        # SFOC should be reasonable
        for sfoc in sfocs:
            assert 150 < sfoc < 200  # g/kWh

        # SFOC should be optimal around 75-85% load
        assert sfocs[1] <= sfocs[0]  # Better at 75% than 50%

    def test_calibration_factors(self):
        """Test that calibration factors affect results."""
        # Default model
        model1 = VesselModel()

        # Model with increased calm water resistance
        model2 = VesselModel(
            calibration_factors={"calm_water": 1.2, "wind": 1.0, "waves": 1.0}
        )

        result1 = model1.calculate_fuel_consumption(14.5, True, None, 348.0)
        result2 = model2.calculate_fuel_consumption(14.5, True, None, 348.0)

        # Model 2 should use more fuel
        assert result2["fuel_mt"] > result1["fuel_mt"]

    def test_get_optimal_speed(self, vessel_model):
        """Test optimal speed calculation."""
        optimal_laden = vessel_model.get_optimal_speed(is_laden=True, weather=None)
        optimal_ballast = vessel_model.get_optimal_speed(is_laden=False, weather=None)

        # Should be near service speeds
        assert 12 < optimal_laden < 17
        assert 12 < optimal_ballast < 18

        # Should be reasonable values
        assert abs(optimal_laden - vessel_model.specs.service_speed_laden) < 3
        assert abs(optimal_ballast - vessel_model.specs.service_speed_ballast) < 3


class TestHoltropMennen:
    """Test Holtrop-Mennen resistance calculations."""

    @pytest.fixture
    def vessel_model(self):
        return VesselModel()

    def test_resistance_increases_with_speed(self, vessel_model):
        """Test that resistance increases with speed."""
        speeds = [10, 12, 14, 16]  # knots
        resistances = []

        for speed_kts in speeds:
            speed_ms = speed_kts * 0.51444
            resistance = vessel_model._holtrop_mennen_resistance(
                speed_ms,
                vessel_model.specs.draft_laden,
                vessel_model.specs.displacement_laden,
                vessel_model.specs.cb_laden,
                vessel_model.specs.wetted_surface_laden,
            )
            resistances.append(resistance)

        # Resistance should increase
        for i in range(len(resistances) - 1):
            assert resistances[i + 1] > resistances[i]

    def test_resistance_positive(self, vessel_model):
        """Test that resistance is always positive."""
        resistance = vessel_model._holtrop_mennen_resistance(
            speed_ms=7.0,
            draft=11.8,
            displacement=65000,
            cb=0.82,
            wetted_surface=7500,
        )

        assert resistance > 0


class TestWindResistance:
    """Test wind resistance calculations."""

    @pytest.fixture
    def vessel_model(self):
        return VesselModel()

    def test_head_wind_worse_than_following(self, vessel_model):
        """Test that head wind produces more resistance than following wind."""
        wind_speed = 15.0  # m/s

        head_wind = vessel_model._wind_resistance(
            wind_speed_ms=wind_speed,
            wind_dir_deg=0,
            heading_deg=0,
            is_laden=True,
        )

        following_wind = vessel_model._wind_resistance(
            wind_speed_ms=wind_speed,
            wind_dir_deg=180,
            heading_deg=0,
            is_laden=True,
        )

        assert head_wind > following_wind

    def test_ballast_has_more_wind_resistance(self, vessel_model):
        """Test that ballast has more wind resistance (more windage)."""
        wind_speed = 15.0

        laden = vessel_model._wind_resistance(
            wind_speed_ms=wind_speed,
            wind_dir_deg=0,
            heading_deg=0,
            is_laden=True,
        )

        ballast = vessel_model._wind_resistance(
            wind_speed_ms=wind_speed,
            wind_dir_deg=0,
            heading_deg=0,
            is_laden=False,
        )

        assert ballast > laden


class TestWaveResistance:
    """Test wave resistance calculations."""

    @pytest.fixture
    def vessel_model(self):
        return VesselModel()

    def test_wave_resistance_increases_with_height(self, vessel_model):
        """Test that wave resistance increases with wave height."""
        wave_heights = [1.0, 2.0, 3.0, 4.0]
        resistances = []

        for height in wave_heights:
            resistance = vessel_model._wave_resistance(
                sig_wave_height_m=height,
                wave_dir_deg=0,
                heading_deg=0,
                speed_ms=7.0,
                is_laden=True,
            )
            resistances.append(resistance)

        # Resistance should increase with wave height
        for i in range(len(resistances) - 1):
            assert resistances[i + 1] > resistances[i]

    def test_head_seas_worse_than_following(self, vessel_model):
        """Test that head seas produce more resistance than following seas."""
        wave_height = 3.0

        head_seas = vessel_model._wave_resistance(
            sig_wave_height_m=wave_height,
            wave_dir_deg=0,
            heading_deg=0,
            speed_ms=7.0,
            is_laden=True,
        )

        following_seas = vessel_model._wave_resistance(
            sig_wave_height_m=wave_height,
            wave_dir_deg=180,
            heading_deg=0,
            speed_ms=7.0,
            is_laden=True,
        )

        assert head_seas > following_seas
