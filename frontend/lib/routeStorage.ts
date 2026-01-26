/**
 * Route persistence using localStorage.
 * Provides CRUD operations for saved routes.
 */

import { Position } from './api';

export interface SavedRoute {
  id: string;
  name: string;
  waypoints: Position[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'windmar_routes';

/**
 * Generate unique ID for routes.
 */
function generateId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all saved routes from localStorage.
 */
export function getRoutes(): SavedRoute[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load routes:', error);
    return [];
  }
}

/**
 * Get a single route by ID.
 */
export function getRoute(id: string): SavedRoute | null {
  const routes = getRoutes();
  return routes.find(r => r.id === id) || null;
}

/**
 * Save a new route.
 */
export function saveRoute(name: string, waypoints: Position[]): SavedRoute {
  const routes = getRoutes();
  const now = new Date().toISOString();

  const newRoute: SavedRoute = {
    id: generateId(),
    name: name || `Route ${routes.length + 1}`,
    waypoints,
    createdAt: now,
    updatedAt: now,
  };

  routes.push(newRoute);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));

  return newRoute;
}

/**
 * Update an existing route.
 */
export function updateRoute(id: string, updates: Partial<Pick<SavedRoute, 'name' | 'waypoints'>>): SavedRoute | null {
  const routes = getRoutes();
  const index = routes.findIndex(r => r.id === id);

  if (index === -1) return null;

  routes[index] = {
    ...routes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  return routes[index];
}

/**
 * Delete a route by ID.
 */
export function deleteRoute(id: string): boolean {
  const routes = getRoutes();
  const filtered = routes.filter(r => r.id !== id);

  if (filtered.length === routes.length) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Export routes to JSON file.
 */
export function exportRoutes(): void {
  const routes = getRoutes();
  const blob = new Blob([JSON.stringify(routes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `windmar_routes_${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import routes from JSON file.
 */
export function importRoutes(jsonString: string): number {
  try {
    const imported = JSON.parse(jsonString) as SavedRoute[];
    const existing = getRoutes();

    // Add imported routes with new IDs to avoid conflicts
    const newRoutes = imported.map(route => ({
      ...route,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const combined = [...existing, ...newRoutes];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));

    return newRoutes.length;
  } catch (error) {
    console.error('Failed to import routes:', error);
    return 0;
  }
}
