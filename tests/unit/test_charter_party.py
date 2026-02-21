"""Tests for Charter Party Weather Clause Tools."""

from datetime import datetime, timedelta

import pytest

from src.compliance.charter_party import (
    BEAUFORT_SCALE,
    CharterPartyCalculator,
)


@pytest.fixture
def calc():
    return CharterPartyCalculator()


# =============================================================================
# Beaufort Classification
# =============================================================================

class TestBeaufortClassification:
    def test_calm(self, calc):
        """0 kts wind → BF 0 (Calm)."""
        assert calc.classify_beaufort(0) == 0

    def test_bf4_lower_bound(self, calc):
        """11 kts → BF 4 (Moderate breeze)."""
        assert calc.classify_beaufort(11) == 4

    def test_bf4_upper_bound(self, calc):
        """16 kts → BF 4 (Moderate breeze)."""
        assert calc.classify_beaufort(16) == 4

    def test_bf12_hurricane(self, calc):
        """64 kts → BF 12 (Hurricane)."""
        assert calc.classify_beaufort(64) == 12

    def test_bf12_extreme(self, calc):
        """100 kts → still BF 12."""
        assert calc.classify_beaufort(100) == 12

    def test_negative_wind(self, calc):
        """Negative wind speed → BF 0."""
        assert calc.classify_beaufort(-5) == 0

    def test_bf_boundary_3_to_4(self, calc):
        """10 kts → BF 3, 11 kts → BF 4."""
        assert calc.classify_beaufort(10) == 3
        assert calc.classify_beaufort(11) == 4


# =============================================================================
# Good Weather Day Counting
# =============================================================================

class TestGoodWeatherDays:
    def test_all_calm_100_pct(self, calc):
        """All calm legs → 100% good weather."""
        legs = [
            {"wind_speed_kts": 5, "wave_height_m": 0.2, "current_speed_ms": 0.1, "time_hours": 24},
            {"wind_speed_kts": 8, "wave_height_m": 0.4, "current_speed_ms": 0.2, "time_hours": 24},
        ]
        result = calc.count_good_weather_days(legs, bf_threshold=4)
        assert result.good_weather_pct == 100.0
        assert result.total_days == pytest.approx(2.0, abs=0.01)
        assert result.bad_weather_days == 0.0

    def test_all_storm_0_pct(self, calc):
        """All storm legs → 0% good weather."""
        legs = [
            {"wind_speed_kts": 50, "wave_height_m": 9.0, "current_speed_ms": 0.5, "time_hours": 48},
        ]
        result = calc.count_good_weather_days(legs, bf_threshold=4)
        assert result.good_weather_pct == 0.0
        assert result.good_weather_days == 0.0
        assert result.bad_weather_days == pytest.approx(2.0, abs=0.01)

    def test_mixed_weather(self, calc):
        """Mixed legs: partial good weather."""
        legs = [
            {"wind_speed_kts": 5, "wave_height_m": 0.2, "current_speed_ms": 0.0, "time_hours": 12},
            {"wind_speed_kts": 30, "wave_height_m": 4.0, "current_speed_ms": 0.5, "time_hours": 12},
        ]
        result = calc.count_good_weather_days(legs, bf_threshold=4)
        assert result.good_weather_pct == 50.0
        assert result.good_weather_days == pytest.approx(0.5, abs=0.01)
        assert result.bad_weather_days == pytest.approx(0.5, abs=0.01)

    def test_custom_bf_threshold(self, calc):
        """BF 7 threshold: 30 kts wind (BF 7) is within limit."""
        legs = [
            {"wind_speed_kts": 30, "wave_height_m": 3.0, "current_speed_ms": 0.0, "time_hours": 24},
        ]
        result = calc.count_good_weather_days(legs, bf_threshold=7)
        assert result.good_weather_pct == 100.0

    def test_wave_filter(self, calc):
        """Wave threshold overrides BF if wave too high."""
        legs = [
            {"wind_speed_kts": 5, "wave_height_m": 3.5, "current_speed_ms": 0.0, "time_hours": 24},
        ]
        # BF 2 wind but waves exceed 2.0m threshold
        result = calc.count_good_weather_days(legs, bf_threshold=4, wave_threshold_m=2.0)
        assert result.good_weather_pct == 0.0

    def test_current_filter(self, calc):
        """Current threshold filters out legs with strong currents."""
        legs = [
            {"wind_speed_kts": 5, "wave_height_m": 0.2, "current_speed_ms": 2.0, "time_hours": 24},
        ]
        # 2.0 m/s ≈ 3.89 kts, threshold 3.0 kts → bad weather
        result = calc.count_good_weather_days(legs, bf_threshold=4, current_threshold_kts=3.0)
        assert result.good_weather_pct == 0.0

    def test_empty_legs(self, calc):
        """Empty leg list → zero totals."""
        result = calc.count_good_weather_days([], bf_threshold=4)
        assert result.total_days == 0.0
        assert result.good_weather_pct == 0.0

    def test_single_leg(self, calc):
        """Single leg works correctly."""
        legs = [{"wind_speed_kts": 10, "wave_height_m": 0.5, "current_speed_ms": 0.0, "time_hours": 6}]
        result = calc.count_good_weather_days(legs, bf_threshold=4)
        assert result.total_days == pytest.approx(0.25, abs=0.01)
        assert len(result.legs) == 1
        assert result.legs[0].bf_force == 3


# =============================================================================
# Warranty Verification
# =============================================================================

class TestWarrantyVerification:
    def _make_legs(self, wind_kts=5, sog=14.0, fuel=2.0, time_h=12, dist=None, count=4):
        """Helper to create uniform legs."""
        if dist is None:
            dist = sog * time_h
        return [
            {
                "wind_speed_kts": wind_kts,
                "wave_height_m": 0.3,
                "current_speed_ms": 0.0,
                "time_hours": time_h,
                "distance_nm": dist,
                "sog_kts": sog,
                "fuel_mt": fuel,
            }
            for _ in range(count)
        ]

    def test_speed_compliant(self, calc):
        """Achieved speed >= warranted → compliant."""
        legs = self._make_legs(sog=14.0, fuel=2.0, time_h=12, dist=168)
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=4.0)
        assert result.speed_compliant is True
        assert result.achieved_speed_kts == pytest.approx(14.0, abs=0.1)

    def test_speed_non_compliant(self, calc):
        """Achieved speed < warranted → non-compliant."""
        legs = self._make_legs(sog=12.0, fuel=2.0, time_h=12, dist=144)
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=4.0)
        assert result.speed_compliant is False
        assert result.speed_margin_kts < 0

    def test_consumption_compliant(self, calc):
        """Achieved consumption <= warranted → compliant."""
        # 2 MT per 12h = 4 MT/day, warranted 5 MT/day → compliant
        legs = self._make_legs(sog=14.0, fuel=2.0, time_h=12, dist=168)
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0)
        assert result.consumption_compliant is True
        assert result.consumption_margin_mt > 0

    def test_consumption_non_compliant(self, calc):
        """Achieved consumption > warranted → non-compliant."""
        # 3 MT per 12h = 6 MT/day, warranted 5 MT/day → non-compliant
        legs = self._make_legs(sog=14.0, fuel=3.0, time_h=12, dist=168)
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0)
        assert result.consumption_compliant is False
        assert result.consumption_margin_mt < 0

    def test_speed_tolerance(self, calc):
        """Speed tolerance: 13.3 kts with 5% tolerance on 14 kts → compliant (min 13.3)."""
        legs = self._make_legs(sog=13.3, fuel=2.0, time_h=12, dist=159.6)
        result = calc.verify_warranty(
            legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0,
            speed_tolerance_pct=5.0,
        )
        assert result.speed_compliant is True

    def test_consumption_tolerance(self, calc):
        """Consumption tolerance: 5.25 MT/day with 10% tolerance on 5 MT/day → compliant."""
        # 5.25 MT/day = 2.625 MT per 12h, max allowed 5.5 MT/day
        legs = self._make_legs(sog=14.0, fuel=2.625, time_h=12, dist=168)
        result = calc.verify_warranty(
            legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0,
            consumption_tolerance_pct=10.0,
        )
        assert result.consumption_compliant is True

    def test_only_good_weather_legs(self, calc):
        """Bad weather legs are excluded from warranty assessment."""
        legs = [
            {"wind_speed_kts": 5, "wave_height_m": 0.3, "current_speed_ms": 0.0,
             "time_hours": 12, "distance_nm": 168, "sog_kts": 14.0, "fuel_mt": 2.0},
            {"wind_speed_kts": 40, "wave_height_m": 5.0, "current_speed_ms": 1.0,
             "time_hours": 12, "distance_nm": 84, "sog_kts": 7.0, "fuel_mt": 4.0},
        ]
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0)
        assert result.legs_good_weather == 1
        assert result.legs_assessed == 2
        # Only good-weather leg: 168nm / 12h = 14 kts
        assert result.achieved_speed_kts == pytest.approx(14.0, abs=0.1)

    def test_no_good_weather_legs(self, calc):
        """No good weather legs → zero achieved values."""
        legs = self._make_legs(wind_kts=50, sog=7.0, fuel=4.0, time_h=12, dist=84)
        result = calc.verify_warranty(legs, warranted_speed_kts=14.0, warranted_consumption_mt_day=5.0)
        assert result.legs_good_weather == 0
        assert result.achieved_speed_kts == 0.0


# =============================================================================
# Off-Hire Detection
# =============================================================================

class TestOffHireDetection:
    def _make_entries(self, count=10, interval_h=1, rpm=80, speed=12.0, event="", place="sea"):
        """Helper to create uniform engine log entries."""
        base = datetime(2025, 6, 1, 0, 0, 0)
        return [
            {
                "timestamp": base + timedelta(hours=i * interval_h),
                "rpm": rpm,
                "speed_stw": speed,
                "event": event,
                "place": place,
            }
            for i in range(count)
        ]

    def test_no_off_hire(self, calc):
        """Normal sailing → no off-hire events."""
        entries = self._make_entries(count=10, rpm=80, speed=12.0)
        result = calc.detect_off_hire(entries)
        assert result.off_hire_hours == 0.0
        assert len(result.events) == 0
        assert result.on_hire_hours == result.total_hours

    def test_zero_rpm(self, calc):
        """Zero RPM entries → engine stopped off-hire."""
        entries = self._make_entries(count=5, rpm=0, speed=0.0)
        result = calc.detect_off_hire(entries)
        assert result.off_hire_hours > 0
        assert any(e.reason == "Engine stopped" for e in result.events)

    def test_drifting(self, calc):
        """Low speed with some RPM → drifting off-hire."""
        entries = self._make_entries(count=5, rpm=20, speed=0.5)
        result = calc.detect_off_hire(entries)
        assert result.off_hire_hours > 0
        assert any(e.reason == "Drifting" for e in result.events)

    def test_at_anchor(self, calc):
        """Anchor event → off-hire."""
        entries = self._make_entries(count=5, rpm=0, speed=0.0, event="Anchor", place="Anchorage")
        result = calc.detect_off_hire(entries)
        assert result.off_hire_hours > 0
        assert any(e.reason == "At anchor" for e in result.events)

    def test_in_port(self, calc):
        """Port event → off-hire."""
        entries = self._make_entries(count=5, rpm=0, speed=0.0, place="Port Rotterdam")
        result = calc.detect_off_hire(entries)
        assert result.off_hire_hours > 0
        assert any(e.reason == "In port" for e in result.events)

    def test_timestamp_gap(self, calc):
        """Large gap between entries → timestamp gap off-hire."""
        base = datetime(2025, 6, 1, 0, 0, 0)
        entries = [
            {"timestamp": base, "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=1), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=10), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=11), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
        ]
        result = calc.detect_off_hire(entries, gap_hours=6)
        assert any(e.reason == "Timestamp gap" for e in result.events)

    def test_merge_adjacent(self, calc):
        """Adjacent off-hire events with same reason get merged."""
        entries = self._make_entries(count=6, rpm=0, speed=0.0)
        result = calc.detect_off_hire(entries)
        # 5 intervals of engine stopped should merge into 1 event
        assert len(result.events) == 1
        assert result.events[0].duration_hours == pytest.approx(5.0, abs=0.01)

    def test_empty_entries(self, calc):
        """Empty entries → zero totals."""
        result = calc.detect_off_hire([])
        assert result.total_hours == 0.0
        assert len(result.events) == 0

    def test_single_entry(self, calc):
        """Single entry → zero totals (need at least 2 for intervals)."""
        entries = self._make_entries(count=1)
        result = calc.detect_off_hire(entries)
        assert result.total_hours == 0.0

    def test_mixed_events(self, calc):
        """Mix of sailing and stopped creates separate events."""
        base = datetime(2025, 6, 1, 0, 0, 0)
        entries = [
            {"timestamp": base, "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=4), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=5), "rpm": 0, "speed_stw": 0, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=8), "rpm": 0, "speed_stw": 0, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=9), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
            {"timestamp": base + timedelta(hours=12), "rpm": 80, "speed_stw": 12, "event": "", "place": "sea"},
        ]
        result = calc.detect_off_hire(entries)
        # Intervals: 0→4 (OK), 4→5 (OK, rpm=80), 5→8 (engine stopped), 8→9 (engine stopped), 9→12 (OK)
        # engine stopped at idx 2 (5→8 = 3h) and idx 3 (8→9 = 1h) — should merge
        off_hire_events = [e for e in result.events if e.reason == "Engine stopped"]
        assert len(off_hire_events) == 1
        assert off_hire_events[0].duration_hours == pytest.approx(4.0, abs=0.01)
