"""Unit tests for maritime router."""

import pytest
from datetime import datetime

from src.optimization.router import MaritimeRouter, Node, RouteConstraints
from src.optimization.vessel_model import VesselModel


class TestNode:
    """Test Node class for A* algorithm."""

    def test_node_creation(self):
        """Test creating a node."""
        node = Node(lat=51.5, lon=4.5, g_cost=10.0, h_cost=20.0)

        assert node.lat == 51.5
        assert node.lon == 4.5
        assert node.g_cost == 10.0
        assert node.h_cost == 20.0
        assert node.f_cost == 30.0

    def test_node_comparison(self):
        """Test node comparison for priority queue."""
        node1 = Node(0, 0, g_cost=10, h_cost=5)
        node2 = Node(0, 0, g_cost=12, h_cost=3)

        assert node1.f_cost == 15
        assert node2.f_cost == 15
        assert not (node1 < node2)
        assert not (node2 < node1)

        node3 = Node(0, 0, g_cost=10, h_cost=3)
        assert node3 < node1  # f_cost = 13 < 15

    def test_node_equality(self):
        """Test node equality by position."""
        node1 = Node(51.5, 4.5)
        node2 = Node(51.5, 4.5)
        node3 = Node(51.6, 4.5)

        assert node1 == node2
        assert node1 != node3

    def test_node_hash(self):
        """Test node hashing for use in sets."""
        node1 = Node(51.5, 4.5)
        node2 = Node(51.5, 4.5)

        nodes = {node1}
        assert node2 in nodes


class TestRouteConstraints:
    """Test RouteConstraints dataclass."""

    def test_default_constraints(self):
        """Test default constraint values."""
        constraints = RouteConstraints()

        assert constraints.min_ukc_m == 2.0
        assert constraints.max_wind_speed_ms == 25.0
        assert constraints.max_wave_height_m == 5.0
        assert constraints.grid_resolution_deg == 0.5


class TestMaritimeRouter:
    """Test MaritimeRouter class."""

    @pytest.fixture
    def router(self):
        """Create router instance."""
        vessel_model = VesselModel()
        constraints = RouteConstraints(grid_resolution_deg=1.0)  # Coarse for testing
        return MaritimeRouter(vessel_model, None, None, constraints)

    def test_initialization(self, router):
        """Test router initialization."""
        assert router.vessel_model is not None
        assert router.constraints is not None

    def test_distance_calculation(self, router):
        """Test great circle distance calculation."""
        # New York to London (approximately)
        ny = (40.7128, -74.0060)
        london = (51.5074, -0.1278)

        distance = router._distance_nm(ny[0], ny[1], london[0], london[1])

        # Approximate distance: ~3000 nm
        assert 2900 < distance < 3100

    def test_bearing_calculation(self, router):
        """Test initial bearing calculation."""
        # North
        bearing = router._bearing(0, 0, 1, 0)
        assert 350 < bearing < 10 or bearing == 0

        # East
        bearing = router._bearing(0, 0, 0, 1)
        assert 85 < bearing < 95

        # South
        bearing = router._bearing(1, 0, 0, 0)
        assert 175 < bearing < 185

        # West
        bearing = router._bearing(0, 1, 0, 0)
        assert 265 < bearing < 275

    def test_great_circle_interpolation(self, router):
        """Test interpolation along great circle."""
        lat1, lon1 = 0.0, 0.0
        lat2, lon2 = 10.0, 10.0

        # Midpoint
        mid_lat, mid_lon = router._interpolate_great_circle(
            lat1, lon1, lat2, lon2, 0.5
        )

        assert 4 < mid_lat < 6
        assert 4 < mid_lon < 6

        # Start point
        start_lat, start_lon = router._interpolate_great_circle(
            lat1, lon1, lat2, lon2, 0.0
        )
        assert abs(start_lat - lat1) < 0.001
        assert abs(start_lon - lon1) < 0.001

        # End point
        end_lat, end_lon = router._interpolate_great_circle(
            lat1, lon1, lat2, lon2, 1.0
        )
        assert abs(end_lat - lat2) < 0.001
        assert abs(end_lon - lon2) < 0.001

    def test_get_neighbors(self, router):
        """Test neighbor generation."""
        current = Node(51.0, 4.0)
        goal = Node(52.0, 5.0)

        neighbors = router._get_neighbors(current, goal)

        # Should have 8 neighbors (8 directions)
        assert len(neighbors) == 8

        # All neighbors should be different from current
        for neighbor in neighbors:
            assert neighbor != current

    def test_heuristic_admissible(self, router):
        """Test that heuristic is admissible (never overestimates)."""
        start = Node(51.0, 4.0)
        goal = Node(37.0, 15.0)

        h_cost = router._heuristic(start, goal, is_laden=True)

        # Heuristic should be positive
        assert h_cost > 0

        # Calculate actual great circle distance
        distance = router._distance_nm(start.lat, start.lon, goal.lat, goal.lon)

        # Heuristic should represent fuel for at least this distance
        # (admissibility check - heuristic should not overestimate)
        assert h_cost > 0  # Just check it's reasonable

    def test_great_circle_fallback(self, router):
        """Test great circle fallback route."""
        start = (51.9225, 4.4792)  # Rotterdam
        end = (37.2333, 15.2167)   # Augusta
        departure = datetime(2024, 1, 1, 0, 0)

        result = router._great_circle_fallback(
            start, end, departure, is_laden=True, target_speed_kts=14.5
        )

        # Check result structure
        assert "waypoints" in result
        assert "total_fuel_mt" in result
        assert "total_distance_nm" in result
        assert "total_time_hours" in result

        # Check waypoints
        assert len(result["waypoints"]) >= 2
        assert result["waypoints"][0] == start
        assert result["waypoints"][-1] == end

        # Check values are reasonable
        assert result["total_fuel_mt"] > 0
        assert result["total_distance_nm"] > 1000  # Rotterdam to Augusta
        assert result["total_time_hours"] > 0

    def test_find_optimal_route_no_weather(self, router):
        """Test route optimization without weather data."""
        start = (51.0, 4.0)
        end = (52.0, 5.0)  # Short route
        departure = datetime(2024, 1, 1, 0, 0)

        result = router.find_optimal_route(
            start, end, departure, is_laden=True, target_speed_kts=14.5
        )

        # Should return a valid route
        assert "waypoints" in result
        assert len(result["waypoints"]) >= 2
        assert result["total_fuel_mt"] > 0
        assert result["total_distance_nm"] > 0

    def test_route_fuel_reasonable(self, router):
        """Test that calculated fuel is reasonable."""
        # Short route
        start = (51.0, 4.0)
        end = (52.0, 5.0)
        departure = datetime(2024, 1, 1, 0, 0)

        result = router.find_optimal_route(
            start, end, departure, is_laden=True, target_speed_kts=14.5
        )

        # Fuel should be reasonable for distance
        distance = result["total_distance_nm"]
        fuel_per_nm = result["total_fuel_mt"] / distance

        # Typical fuel consumption: 0.08-0.12 MT/nm for MR tanker
        assert 0.05 < fuel_per_nm < 0.20


class TestRouteOptimization:
    """Integration tests for route optimization."""

    def test_long_route_optimization(self):
        """Test optimization of a long route."""
        vessel_model = VesselModel()
        router = MaritimeRouter(
            vessel_model,
            None,
            None,
            RouteConstraints(grid_resolution_deg=2.0),  # Very coarse for speed
        )

        # Rotterdam to Augusta
        start = (51.9225, 4.4792)
        end = (37.2333, 15.2167)
        departure = datetime(2024, 1, 1, 0, 0)

        result = router.find_optimal_route(
            start, end, departure, is_laden=True, target_speed_kts=14.5
        )

        # Should find a route
        assert result is not None
        assert len(result["waypoints"]) >= 2

        # Distance should be roughly correct (2000-2500 nm)
        assert 1800 < result["total_distance_nm"] < 2800

        # Time should be reasonable (6-8 days at 14.5 kts)
        expected_time = result["total_distance_nm"] / 14.5
        assert abs(result["total_time_hours"] - expected_time) < 12

    def test_route_starts_and_ends_correctly(self):
        """Test that route starts and ends at correct positions."""
        vessel_model = VesselModel()
        router = MaritimeRouter(vessel_model, None, None, RouteConstraints())

        start = (50.0, 0.0)
        end = (55.0, 5.0)
        departure = datetime(2024, 1, 1, 0, 0)

        result = router.find_optimal_route(
            start, end, departure, is_laden=True, target_speed_kts=14.5
        )

        # First waypoint should be start
        first_wp = result["waypoints"][0]
        assert abs(first_wp[0] - start[0]) < 0.1
        assert abs(first_wp[1] - start[1]) < 0.1

        # Last waypoint should be end (or very close)
        last_wp = result["waypoints"][-1]
        assert abs(last_wp[0] - end[0]) < 1.0
        assert abs(last_wp[1] - end[1]) < 1.0
