"""Integration tests for Charter Party Weather Clause API endpoints."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers.charter_party import router
from src.compliance.charter_party import BEAUFORT_SCALE


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


# =============================================================================
# Beaufort Scale
# =============================================================================

def test_beaufort_scale_returns_13_entries(client):
    """GET /beaufort-scale returns all 13 Beaufort forces (0-12)."""
    resp = client.get("/api/charter-party/beaufort-scale")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["scale"]) == 13
    assert data["scale"][0]["force"] == 0
    assert data["scale"][12]["force"] == 12
    assert data["scale"][0]["description"] == "Calm"


# =============================================================================
# Good Weather (from-legs)
# =============================================================================

def test_good_weather_from_legs_all_calm(client):
    """All calm legs → 100% good weather."""
    resp = client.post("/api/charter-party/good-weather/from-legs", json={
        "legs": [
            {"wind_speed_kts": 5, "wave_height_m": 0.2, "time_hours": 24},
            {"wind_speed_kts": 8, "wave_height_m": 0.4, "time_hours": 24},
        ],
        "bf_threshold": 4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["good_weather_pct"] == 100.0
    assert len(data["legs"]) == 2


def test_good_weather_from_legs_mixed(client):
    """Mixed legs → partial good weather."""
    resp = client.post("/api/charter-party/good-weather/from-legs", json={
        "legs": [
            {"wind_speed_kts": 5, "time_hours": 12},
            {"wind_speed_kts": 50, "time_hours": 12},
        ],
        "bf_threshold": 4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["good_weather_pct"] == 50.0


def test_good_weather_bad_bf_threshold(client):
    """Invalid BF threshold → 422."""
    resp = client.post("/api/charter-party/good-weather/from-legs", json={
        "legs": [{"wind_speed_kts": 5, "time_hours": 12}],
        "bf_threshold": 15,  # max is 12
    })
    assert resp.status_code == 422


# =============================================================================
# Warranty Verification (from-legs)
# =============================================================================

def test_warranty_from_legs_compliant(client):
    """Compliant speed and consumption → both true."""
    resp = client.post("/api/charter-party/verify-warranty/from-legs", json={
        "legs": [
            {"wind_speed_kts": 5, "time_hours": 12, "distance_nm": 168, "sog_kts": 14, "fuel_mt": 2.5},
        ],
        "warranted_speed_kts": 14.0,
        "warranted_consumption_mt_day": 5.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["speed_compliant"] is True
    assert data["consumption_compliant"] is True


def test_warranty_negative_speed_rejected(client):
    """Negative warranted speed → 422."""
    resp = client.post("/api/charter-party/verify-warranty/from-legs", json={
        "legs": [{"wind_speed_kts": 5, "time_hours": 12, "distance_nm": 100, "sog_kts": 10, "fuel_mt": 1}],
        "warranted_speed_kts": -1,
        "warranted_consumption_mt_day": 5.0,
    })
    assert resp.status_code == 422


def test_warranty_speed_too_high_rejected(client):
    """Warranted speed > 30 kts → 422."""
    resp = client.post("/api/charter-party/verify-warranty/from-legs", json={
        "legs": [{"wind_speed_kts": 5, "time_hours": 12, "distance_nm": 100, "sog_kts": 10, "fuel_mt": 1}],
        "warranted_speed_kts": 35,
        "warranted_consumption_mt_day": 5.0,
    })
    assert resp.status_code == 422


def test_warranty_empty_legs_rejected(client):
    """Empty legs array → 422."""
    resp = client.post("/api/charter-party/verify-warranty/from-legs", json={
        "legs": [],
        "warranted_speed_kts": 14,
        "warranted_consumption_mt_day": 5.0,
    })
    assert resp.status_code == 422
