"""Unit tests for Phase 3e: Speed step refinement (0.5 kt increments)."""

import numpy as np
import pytest

from src.optimization.route_optimizer import RouteOptimizer


class TestSpeedSteps:
    """Verify speed range produces 0.5 kt increments from 10.0 to 16.0."""

    def test_speed_steps_half_knot_increments(self):
        """linspace(10.0, 16.0, 13) must produce exactly 0.5 kt steps."""
        min_speed, max_speed = RouteOptimizer.SPEED_RANGE_KTS
        steps = RouteOptimizer.SPEED_STEPS
        speeds = np.linspace(min_speed, max_speed, steps)

        # Check step size is 0.5 kt
        diffs = np.diff(speeds)
        np.testing.assert_allclose(diffs, 0.5, atol=1e-10)

    def test_speed_range_endpoints(self):
        """Speed range must be (10.0, 16.0) with 13 steps."""
        assert RouteOptimizer.SPEED_RANGE_KTS == (10.0, 16.0)
        assert RouteOptimizer.SPEED_STEPS == 13

        speeds = np.linspace(*RouteOptimizer.SPEED_RANGE_KTS, RouteOptimizer.SPEED_STEPS)
        assert speeds[0] == 10.0
        assert speeds[-1] == 16.0
        assert len(speeds) == 13
