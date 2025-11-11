"""Unit tests for Excel noon report parser."""

import pytest
import pandas as pd
from pathlib import Path
from datetime import datetime
import tempfile

from src.database.excel_parser import ExcelParser


class TestExcelParser:
    """Test ExcelParser class."""

    @pytest.fixture
    def sample_excel_file(self):
        """Create a sample Excel file for testing."""
        # Create sample data
        data = {
            "Date": pd.date_range(start="2024-01-01", periods=10, freq="D"),
            "Latitude": [50.0 + i * 0.5 for i in range(10)],
            "Longitude": [0.0 + i * 0.5 for i in range(10)],
            "Speed": [14.5] * 10,
            "Distance": [348.0] * 10,
            "Fuel_Consumption": [35.0] * 10,
            "Wind_Speed": [5] * 10,
            "Condition": ["Laden"] * 5 + ["Ballast"] * 5,
        }

        df = pd.DataFrame(data)

        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            df.to_excel(f.name, index=False)
            return Path(f.name)

    def test_initialization(self, sample_excel_file):
        """Test parser initialization."""
        parser = ExcelParser(sample_excel_file)
        assert parser.excel_file == sample_excel_file

    def test_initialization_file_not_found(self):
        """Test that FileNotFoundError is raised for missing file."""
        with pytest.raises(FileNotFoundError):
            ExcelParser(Path("nonexistent_file.xlsx"))

    def test_parse_valid_file(self, sample_excel_file):
        """Test parsing a valid Excel file."""
        parser = ExcelParser(sample_excel_file)
        reports = parser.parse()

        assert len(reports) == 10
        assert all("date" in r for r in reports)
        assert all("latitude" in r for r in reports)
        assert all("longitude" in r for r in reports)
        assert all("fuel_consumption_mt" in r for r in reports)

    def test_parse_extracts_correct_values(self, sample_excel_file):
        """Test that parsed values are correct."""
        parser = ExcelParser(sample_excel_file)
        reports = parser.parse()

        first_report = reports[0]
        assert first_report["latitude"] == 50.0
        assert first_report["longitude"] == 0.0
        assert first_report["fuel_consumption_mt"] == 35.0
        assert first_report["speed_kts"] == 14.5

    def test_column_mapping(self, sample_excel_file):
        """Test that columns are mapped correctly."""
        parser = ExcelParser(sample_excel_file)
        parser.parse()

        assert "date" in parser.column_map
        assert "latitude" in parser.column_map
        assert "longitude" in parser.column_map
        assert "fuel_consumption" in parser.column_map

    def test_loading_condition_detection(self, sample_excel_file):
        """Test that loading condition is detected correctly."""
        parser = ExcelParser(sample_excel_file)
        reports = parser.parse()

        # First 5 should be laden
        assert all(r["is_laden"] for r in reports[:5])

        # Last 5 should be ballast
        assert all(not r["is_laden"] for r in reports[5:])

    def test_wind_direction_conversion(self):
        """Test wind direction conversion from text to degrees."""
        parser = ExcelParser.__new__(ExcelParser)

        assert parser._convert_value("wind_direction", "N") == 0
        assert parser._convert_value("wind_direction", "E") == 90
        assert parser._convert_value("wind_direction", "S") == 180
        assert parser._convert_value("wind_direction", "W") == 270
        assert parser._convert_value("wind_direction", "NE") == 45

    def test_wind_speed_beaufort_conversion(self):
        """Test Beaufort to m/s conversion."""
        parser = ExcelParser.__new__(ExcelParser)

        # Beaufort 4 should be around 7 m/s
        result = parser._convert_value("wind_speed", 4)
        assert 5 < result < 10

        # High values (already m/s) should pass through
        result = parser._convert_value("wind_speed", 15)
        assert result == 15

    def test_statistics(self, sample_excel_file):
        """Test statistics calculation."""
        parser = ExcelParser(sample_excel_file)
        parser.parse()

        stats = parser.get_statistics()

        assert stats["total_reports"] == 10
        assert "date_range" in stats
        assert stats["total_fuel_mt"] == 350.0  # 10 reports * 35 MT
        assert stats["avg_daily_fuel_mt"] == 35.0

    def test_invalid_position_filtered(self):
        """Test that invalid positions are filtered out."""
        # Create Excel with invalid position
        data = {
            "Date": [datetime(2024, 1, 1)],
            "Latitude": [999.0],  # Invalid
            "Longitude": [0.0],
            "Fuel_Consumption": [35.0],
        }

        df = pd.DataFrame(data)

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            df.to_excel(f.name, index=False)
            temp_file = Path(f.name)

        parser = ExcelParser(temp_file)
        reports = parser.parse()

        # Should filter out invalid position
        assert len(reports) == 0

        # Clean up
        temp_file.unlink()

    def test_invalid_fuel_filtered(self):
        """Test that invalid fuel values are filtered out."""
        data = {
            "Date": [datetime(2024, 1, 1)],
            "Latitude": [50.0],
            "Longitude": [0.0],
            "Fuel_Consumption": [-10.0],  # Invalid (negative)
        }

        df = pd.DataFrame(data)

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            df.to_excel(f.name, index=False)
            temp_file = Path(f.name)

        parser = ExcelParser(temp_file)
        reports = parser.parse()

        assert len(reports) == 0

        temp_file.unlink()


class TestExcelParserEdgeCases:
    """Test edge cases for Excel parser."""

    def test_missing_required_columns(self):
        """Test handling of missing required columns."""
        # Create Excel with missing fuel column
        data = {
            "Date": [datetime(2024, 1, 1)],
            "Latitude": [50.0],
            "Longitude": [0.0],
            # Missing: Fuel_Consumption
        }

        df = pd.DataFrame(data)

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            df.to_excel(f.name, index=False)
            temp_file = Path(f.name)

        parser = ExcelParser(temp_file)

        with pytest.raises(ValueError, match="Required columns not found"):
            parser.parse()

        temp_file.unlink()

    def test_empty_file(self):
        """Test handling of empty Excel file."""
        df = pd.DataFrame()

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            df.to_excel(f.name, index=False)
            temp_file = Path(f.name)

        parser = ExcelParser(temp_file)

        with pytest.raises(ValueError):
            parser.parse()

        temp_file.unlink()
