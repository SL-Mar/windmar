/**
 * Tests for the RouteMap component.
 *
 * Note: Leaflet is mocked in jest.setup.ts since it doesn't work in jsdom.
 */

import { render, screen, waitFor } from '@testing-library/react';
import RouteMap from '../RouteMap';

describe('RouteMap', () => {
  const mockWaypoints: [number, number][] = [
    [51.9, 4.5],   // Rotterdam
    [48.0, -5.0],  // Mid Atlantic
    [36.1, -5.4],  // Gibraltar
  ];

  it('shows loading when waypoints are empty', async () => {
    render(<RouteMap waypoints={[]} />);

    // With empty waypoints, should show loading placeholder
    await waitFor(() => {
      expect(screen.getByText('Loading map...')).toBeInTheDocument();
    });
  });

  it('renders map container after mount', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  it('renders tile layer', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
    });
  });

  it('renders polyline with waypoints', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      const polyline = screen.getByTestId('polyline');
      expect(polyline).toBeInTheDocument();
      expect(polyline).toHaveAttribute('data-positions', JSON.stringify(mockWaypoints));
    });
  });

  it('renders start marker', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      expect(markers.length).toBeGreaterThanOrEqual(1);

      // First marker should be at start position
      const startMarker = markers[0];
      expect(startMarker).toHaveAttribute('data-position', JSON.stringify(mockWaypoints[0]));
    });
  });

  it('renders end marker', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      expect(markers.length).toBe(2);

      // Second marker should be at end position
      const endMarker = markers[1];
      const endPosition = mockWaypoints[mockWaypoints.length - 1];
      expect(endMarker).toHaveAttribute('data-position', JSON.stringify(endPosition));
    });
  });

  it('renders default labels in popups', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('Destination')).toBeInTheDocument();
    });
  });

  it('renders custom labels when provided', async () => {
    render(
      <RouteMap
        waypoints={mockWaypoints}
        startLabel="Rotterdam"
        endLabel="Gibraltar"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Rotterdam')).toBeInTheDocument();
      expect(screen.getByText('Gibraltar')).toBeInTheDocument();
    });
  });

  it('displays coordinates in popups', async () => {
    render(<RouteMap waypoints={mockWaypoints} />);

    await waitFor(() => {
      // Check that coordinates are displayed (formatted with toFixed(4))
      expect(screen.getByText(/51\.9000°N/)).toBeInTheDocument();
      expect(screen.getByText(/4\.5000°E/)).toBeInTheDocument();
    });
  });

  it('handles two-point route', async () => {
    const twoPoints: [number, number][] = [
      [51.9, 4.5],
      [36.1, -5.4],
    ];

    render(<RouteMap waypoints={twoPoints} />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(2);
    });
  });

  it('handles single-point route (no end marker)', async () => {
    const singlePoint: [number, number][] = [[51.9, 4.5]];

    render(<RouteMap waypoints={singlePoint} />);

    await waitFor(() => {
      const markers = screen.getAllByTestId('marker');
      // Only start marker should be rendered when there's a single point
      expect(markers).toHaveLength(1);
    });
  });
});
