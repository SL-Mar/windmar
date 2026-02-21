"""
Unit tests for CII Simulator (Phase 2b).

Tests:
- get_rating_boundaries_for_year() calculator method
- POST /api/cii/speed-sweep
- GET /api/cii/thresholds
- POST /api/cii/fleet
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.compliance.cii import CIICalculator, CIIRating, VesselType


# ---------------------------------------------------------------------------
# Unit tests: get_rating_boundaries_for_year()
# ---------------------------------------------------------------------------


class TestGetRatingBoundariesForYear:
    """Tests for the new public method on CIICalculator."""

    @pytest.fixture
    def calc(self):
        return CIICalculator(vessel_type=VesselType.TANKER, dwt=49000, year=2024)

    def test_returns_required_cii(self, calc):
        info = calc.get_rating_boundaries_for_year(2024)
        assert "required_cii" in info
        assert info["required_cii"] > 0

    def test_returns_boundaries(self, calc):
        info = calc.get_rating_boundaries_for_year(2024)
        b = info["boundaries"]
        assert "A_upper" in b
        assert "B_upper" in b
        assert "C_upper" in b
        assert "D_upper" in b

    def test_boundaries_are_ordered(self, calc):
        info = calc.get_rating_boundaries_for_year(2024)
        b = info["boundaries"]
        assert b["A_upper"] < b["B_upper"] < b["C_upper"] < b["D_upper"]

    def test_reduction_factor_increases_over_years(self, calc):
        rf_2024 = calc.get_rating_boundaries_for_year(2024)["reduction_factor"]
        rf_2030 = calc.get_rating_boundaries_for_year(2030)["reduction_factor"]
        assert rf_2030 > rf_2024

    def test_required_cii_decreases_over_years(self, calc):
        """Required CII tightens (decreases) as reduction factors increase."""
        r_2024 = calc.get_rating_boundaries_for_year(2024)["required_cii"]
        r_2030 = calc.get_rating_boundaries_for_year(2030)["required_cii"]
        assert r_2030 < r_2024

    def test_boundaries_tighten_monotonically(self, calc):
        """A_upper boundary should decrease each year (tightening)."""
        prev = None
        for year in range(2019, 2036):
            info = calc.get_rating_boundaries_for_year(year)
            a_upper = info["boundaries"]["A_upper"]
            if prev is not None:
                assert a_upper <= prev, f"A_upper did not decrease from {year-1} to {year}"
            prev = a_upper

    def test_year_2019_has_zero_reduction(self, calc):
        info = calc.get_rating_boundaries_for_year(2019)
        assert info["reduction_factor"] == 0.0

    def test_works_for_bulk_carrier(self):
        calc = CIICalculator(vessel_type=VesselType.BULK_CARRIER, dwt=75000)
        info = calc.get_rating_boundaries_for_year(2026)
        assert info["required_cii"] > 0
        assert info["boundaries"]["A_upper"] < info["boundaries"]["D_upper"]


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


class TestSpeedSweepEndpoint:
    """Tests for POST /api/cii/speed-sweep."""

    def test_speed_sweep_basic(self, client):
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "vessel_type": "tanker",
            "distance_nm": 4000,
            "voyages_per_year": 12,
            "fuel_type": "vlsfo",
            "year": 2026,
            "speed_min_kts": 10,
            "speed_max_kts": 14,
            "speed_step_kts": 1.0,
            "is_laden": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "points" in data
        assert "optimal_speed_kts" in data
        assert "rating_boundaries" in data
        assert len(data["points"]) >= 4  # 10, 11, 12, 13, 14

    def test_speed_sweep_cii_increases_with_speed(self, client):
        """Higher speed should result in higher CII (more fuel)."""
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "vessel_type": "tanker",
            "distance_nm": 4000,
            "voyages_per_year": 12,
            "fuel_type": "vlsfo",
            "year": 2026,
            "speed_min_kts": 8,
            "speed_max_kts": 16,
            "speed_step_kts": 1.0,
            "is_laden": True,
        })
        assert resp.status_code == 200
        points = resp.json()["points"]
        ciis = [p["attained_cii"] for p in points]
        # CII should generally increase with speed (fuel ~ speed^3)
        assert ciis[-1] > ciis[0]

    def test_speed_sweep_points_have_all_fields(self, client):
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "vessel_type": "tanker",
            "distance_nm": 4000,
            "voyages_per_year": 12,
            "fuel_type": "vlsfo",
            "year": 2026,
            "speed_min_kts": 10,
            "speed_max_kts": 12,
            "speed_step_kts": 1.0,
            "is_laden": True,
        })
        assert resp.status_code == 200
        point = resp.json()["points"][0]
        for field in ["speed_kts", "fuel_per_voyage_mt", "annual_fuel_mt", "annual_co2_mt", "attained_cii", "required_cii", "rating"]:
            assert field in point, f"Missing field: {field}"

    def test_speed_sweep_invalid_range(self, client):
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "distance_nm": 4000,
            "speed_min_kts": 16,
            "speed_max_kts": 10,
        })
        assert resp.status_code == 400

    def test_speed_sweep_invalid_fuel_type(self, client):
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "distance_nm": 4000,
            "fuel_type": "unobtanium",
            "speed_min_kts": 10,
            "speed_max_kts": 14,
        })
        assert resp.status_code == 400

    def test_speed_sweep_ratings_vary(self, client):
        """Wide speed range should produce different ratings."""
        resp = client.post("/api/cii/speed-sweep", json={
            "dwt": 49000,
            "vessel_type": "tanker",
            "distance_nm": 4000,
            "voyages_per_year": 12,
            "fuel_type": "vlsfo",
            "year": 2026,
            "speed_min_kts": 6,
            "speed_max_kts": 18,
            "speed_step_kts": 0.5,
            "is_laden": True,
        })
        assert resp.status_code == 200
        ratings = set(p["rating"] for p in resp.json()["points"])
        assert len(ratings) >= 2, "Expected at least 2 different ratings across wide speed range"


class TestThresholdsEndpoint:
    """Tests for GET /api/cii/thresholds."""

    def test_thresholds_basic(self, client):
        resp = client.get("/api/cii/thresholds", params={"dwt": 49000, "vessel_type": "tanker"})
        assert resp.status_code == 200
        data = resp.json()
        assert "years" in data
        assert "vessel_type" in data
        assert "capacity" in data

    def test_thresholds_covers_2019_to_2035(self, client):
        resp = client.get("/api/cii/thresholds", params={"dwt": 49000})
        years = [y["year"] for y in resp.json()["years"]]
        assert 2019 in years
        assert 2035 in years
        assert len(years) == 17

    def test_thresholds_tighten_over_time(self, client):
        """Required CII should decrease (tighten) over years."""
        resp = client.get("/api/cii/thresholds", params={"dwt": 49000, "vessel_type": "tanker"})
        years_data = resp.json()["years"]
        required_values = [y["required_cii"] for y in years_data]
        # Each year's required CII should be <= previous
        for i in range(1, len(required_values)):
            assert required_values[i] <= required_values[i - 1]

    def test_thresholds_have_boundaries(self, client):
        resp = client.get("/api/cii/thresholds", params={"dwt": 49000})
        first_year = resp.json()["years"][0]
        assert "boundaries" in first_year
        assert "A_upper" in first_year["boundaries"]
        assert "D_upper" in first_year["boundaries"]

    def test_thresholds_reduction_factor_increases(self, client):
        resp = client.get("/api/cii/thresholds", params={"dwt": 49000})
        rf = [y["reduction_factor"] for y in resp.json()["years"]]
        # 2019=0, subsequent years should be >= previous
        for i in range(1, len(rf)):
            assert rf[i] >= rf[i - 1]

    def test_thresholds_different_vessel_types(self, client):
        resp_tanker = client.get("/api/cii/thresholds", params={"dwt": 49000, "vessel_type": "tanker"})
        resp_bulk = client.get("/api/cii/thresholds", params={"dwt": 75000, "vessel_type": "bulk_carrier"})
        assert resp_tanker.status_code == 200
        assert resp_bulk.status_code == 200
        # Different reference params → different required CII
        assert resp_tanker.json()["years"][0]["required_cii"] != resp_bulk.json()["years"][0]["required_cii"]

    def test_thresholds_missing_dwt(self, client):
        resp = client.get("/api/cii/thresholds")
        assert resp.status_code == 422  # Pydantic validation error


class TestFleetEndpoint:
    """Tests for POST /api/cii/fleet."""

    def test_fleet_basic(self, client):
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {
                    "name": "Tanker A",
                    "dwt": 49000,
                    "vessel_type": "tanker",
                    "fuel_consumption_mt": {"vlsfo": 5000},
                    "total_distance_nm": 50000,
                    "year": 2026,
                },
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert "summary" in data
        assert len(data["results"]) == 1

    def test_fleet_multiple_vessels(self, client):
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {"name": "V1", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 5000}, "total_distance_nm": 50000, "year": 2026},
                {"name": "V2", "dwt": 75000, "vessel_type": "bulk_carrier", "fuel_consumption_mt": {"vlsfo": 7000}, "total_distance_nm": 60000, "year": 2026},
                {"name": "V3", "dwt": 30000, "vessel_type": "container", "fuel_consumption_mt": {"vlsfo": 3000}, "total_distance_nm": 40000, "year": 2026},
                {"name": "V4", "dwt": 120000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 12000}, "total_distance_nm": 80000, "year": 2026},
                {"name": "V5", "dwt": 50000, "vessel_type": "general_cargo", "fuel_consumption_mt": {"vlsfo": 4500}, "total_distance_nm": 45000, "year": 2026},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 5
        # Summary should have correct total
        assert data["summary"]["total"] == 5
        # Sum of ratings should equal total
        rating_sum = sum(data["summary"].get(r, 0) for r in ["A", "B", "C", "D", "E"])
        assert rating_sum == 5

    def test_fleet_result_fields(self, client):
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {"name": "Test", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 5000}, "total_distance_nm": 50000, "year": 2026},
            ],
        })
        assert resp.status_code == 200
        r = resp.json()["results"][0]
        for field in ["name", "rating", "attained_cii", "required_cii", "compliance_status", "total_co2_mt", "margin_to_downgrade", "margin_to_upgrade"]:
            assert field in r, f"Missing field: {field}"

    def test_fleet_compliance_statuses(self, client):
        """Fleet with varied fuel should produce different compliance statuses."""
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {"name": "Efficient", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 2000}, "total_distance_nm": 60000, "year": 2026},
                {"name": "Polluter", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 15000}, "total_distance_nm": 30000, "year": 2026},
            ],
        })
        assert resp.status_code == 200
        statuses = set(r["compliance_status"] for r in resp.json()["results"])
        assert len(statuses) >= 2

    def test_fleet_empty_list_rejected(self, client):
        resp = client.post("/api/cii/fleet", json={"vessels": []})
        assert resp.status_code == 422

    def test_fleet_invalid_vessel_type(self, client):
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {"name": "Bad", "dwt": 49000, "vessel_type": "submarine", "fuel_consumption_mt": {"vlsfo": 5000}, "total_distance_nm": 50000, "year": 2026},
            ],
        })
        assert resp.status_code == 400

    def test_fleet_summary_counts_correct(self, client):
        """Summary should count ratings correctly."""
        resp = client.post("/api/cii/fleet", json={
            "vessels": [
                {"name": "V1", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 5000}, "total_distance_nm": 50000, "year": 2026},
                {"name": "V2", "dwt": 49000, "vessel_type": "tanker", "fuel_consumption_mt": {"vlsfo": 5000}, "total_distance_nm": 50000, "year": 2026},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        # Both vessels are identical, should get same rating
        assert data["results"][0]["rating"] == data["results"][1]["rating"]
        rating = data["results"][0]["rating"]
        assert data["summary"][rating] == 2
