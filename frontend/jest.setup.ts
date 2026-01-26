/**
 * Jest setup file for extending expect with jest-dom matchers.
 *
 * @see https://github.com/testing-library/jest-dom
 */

import '@testing-library/jest-dom';
import React from 'react';

// Mock next/navigation for tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Leaflet for RouteMap tests (Leaflet doesn't work in jsdom)
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: undefined,
      },
      mergeOptions: jest.fn(),
    },
  },
  latLngBounds: jest.fn(() => ({
    extend: jest.fn(),
    isValid: jest.fn(() => true),
  })),
}));

// Mock react-leaflet components using React.createElement (no JSX in setup files)
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () =>
    React.createElement('div', { 'data-testid': 'tile-layer' }),
  Polyline: ({ positions }: { positions: [number, number][] }) =>
    React.createElement('div', {
      'data-testid': 'polyline',
      'data-positions': JSON.stringify(positions),
    }),
  Marker: ({ position, children }: { position: [number, number]; children?: React.ReactNode }) =>
    React.createElement(
      'div',
      { 'data-testid': 'marker', 'data-position': JSON.stringify(position) },
      children
    ),
  Popup: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'popup' }, children),
  useMap: () => ({
    fitBounds: jest.fn(),
  }),
}));

// Suppress console errors from Recharts in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock ResizeObserver (used by Recharts)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
