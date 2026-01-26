"""Unit tests for validation utilities."""

import pytest

from src.validation import (
    ValidationError,
    validate_speed,
    validate_distance,
    validate_coordinates,
    validate_position,
    validate_weather,
    validate_vessel_specs,
)


class TestValidateSpeed:
    """Test speed validation."""

    def test_valid_speed(self):
        """Test valid speed values."""
        validate_speed(10.0)
        validate_speed(14.5)
        validate_speed(1.0)
        validate_speed(24.9)

    def test_speed_zero(self):
        """Test zero speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_speed(0)
        assert "positive" in str(exc_info.value).lower()

    def test_speed_negative(self):
        """Test negative speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_speed(-5.0)
        assert "positive" in str(exc_info.value).lower()

    def test_speed_too_high(self):
        """Test excessive speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_speed(30.0)
        assert "25" in str(exc_info.value)

    def test_speed_none(self):
        """Test None speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_speed(None)
        assert "required" in str(exc_info.value).lower()


class TestValidateDistance:
    """Test distance validation."""

    def test_valid_distance(self):
        """Test valid distance values."""
        validate_distance(0.0)  # Zero is valid (same point)
        validate_distance(100.0)
        validate_distance(10000.0)

    def test_distance_negative(self):
        """Test negative distance is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_distance(-10.0)
        assert "negative" in str(exc_info.value).lower()

    def test_distance_too_large(self):
        """Test excessive distance is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_distance(25000.0)
        assert "20000" in str(exc_info.value)


class TestValidateCoordinates:
    """Test coordinate validation."""

    def test_valid_coordinates(self):
        """Test valid coordinate values."""
        validate_coordinates(0.0, 0.0)
        validate_coordinates(51.5, -0.1)  # London
        validate_coordinates(-33.9, 18.4)  # Cape Town
        validate_coordinates(90.0, 180.0)  # Extremes
        validate_coordinates(-90.0, -180.0)  # Extremes

    def test_latitude_too_high(self):
        """Test latitude > 90 is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_coordinates(91.0, 0.0)
        assert "latitude" in str(exc_info.value).lower()
        assert "-90" in str(exc_info.value) and "90" in str(exc_info.value)

    def test_latitude_too_low(self):
        """Test latitude < -90 is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_coordinates(-91.0, 0.0)
        assert "latitude" in str(exc_info.value).lower()

    def test_longitude_too_high(self):
        """Test longitude > 180 is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_coordinates(0.0, 181.0)
        assert "longitude" in str(exc_info.value).lower()

    def test_longitude_too_low(self):
        """Test longitude < -180 is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_coordinates(0.0, -181.0)
        assert "longitude" in str(exc_info.value).lower()


class TestValidatePosition:
    """Test position tuple validation."""

    def test_valid_position(self):
        """Test valid position tuples."""
        validate_position((51.5, -0.1))
        validate_position([51.5, -0.1])  # List is also valid

    def test_position_none(self):
        """Test None position is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_position(None)
        assert "required" in str(exc_info.value).lower()

    def test_position_wrong_format(self):
        """Test invalid position format."""
        with pytest.raises(ValidationError):
            validate_position((51.5,))  # Only one element

        with pytest.raises(ValidationError):
            validate_position((51.5, -0.1, 100.0))  # Too many elements


class TestValidateWeather:
    """Test weather conditions validation."""

    def test_weather_none(self):
        """Test None weather is valid (weather is optional)."""
        validate_weather(None)

    def test_valid_weather(self):
        """Test valid weather conditions."""
        validate_weather({
            "wind_speed_ms": 10.0,
            "wind_dir_deg": 180.0,
            "sig_wave_height_m": 2.0,
            "wave_dir_deg": 90.0,
            "heading_deg": 0.0,
        })

    def test_wind_speed_negative(self):
        """Test negative wind speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_weather({"wind_speed_ms": -5.0})
        assert "negative" in str(exc_info.value).lower()

    def test_wind_speed_too_high(self):
        """Test excessive wind speed is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_weather({"wind_speed_ms": 60.0})
        assert "hurricane" in str(exc_info.value).lower()

    def test_wave_height_negative(self):
        """Test negative wave height is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_weather({"sig_wave_height_m": -2.0})
        assert "negative" in str(exc_info.value).lower()

    def test_wave_height_too_high(self):
        """Test excessive wave height is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_weather({"sig_wave_height_m": 25.0})
        assert "extreme" in str(exc_info.value).lower()


class TestValidateVesselSpecs:
    """Test vessel specifications validation."""

    def test_valid_specs(self):
        """Test valid vessel specs."""
        validate_vessel_specs({
            "dwt": 49000.0,
            "loa": 183.0,
            "beam": 32.0,
            "draft_laden": 11.8,
            "draft_ballast": 6.5,
            "mcr_kw": 8840.0,
            "sfoc_at_mcr": 171.0,
            "service_speed_laden": 14.5,
            "service_speed_ballast": 15.0,
        })

    def test_draft_inconsistency(self):
        """Test laden draft must be greater than ballast draft."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vessel_specs({
                "draft_laden": 6.0,
                "draft_ballast": 8.0,  # Ballast > laden is wrong
            })
        assert "laden" in str(exc_info.value).lower()
        assert "ballast" in str(exc_info.value).lower()

    def test_dwt_out_of_range(self):
        """Test DWT out of range."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vessel_specs({"dwt": 100.0})  # Too small
        assert "dwt" in str(exc_info.value).lower()


class TestValidationError:
    """Test ValidationError exception."""

    def test_error_attributes(self):
        """Test ValidationError has correct attributes."""
        error = ValidationError("speed", "must be positive", -5)
        assert error.field == "speed"
        assert error.message == "must be positive"
        assert error.value == -5

    def test_error_message(self):
        """Test ValidationError string representation."""
        error = ValidationError("speed", "must be positive", -5)
        assert "speed" in str(error)
        assert "must be positive" in str(error)
