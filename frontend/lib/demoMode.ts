/**
 * Demo mode constants and helpers.
 *
 * Controlled by the NEXT_PUBLIC_DEMO_MODE env var (set at build time).
 */

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_TOOLTIP =
  'This feature is disabled in demo mode.';

/** Canarias -> North Sea bounding box for map lock.
 *  Capped at 55°N to match CMEMS wave data coverage (avoids truncated overlays). */
export const DEMO_BOUNDS: [[number, number], [number, number]] = [
  [25, -20],
  [55, 10],
];
