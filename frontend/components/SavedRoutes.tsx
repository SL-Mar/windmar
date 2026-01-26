'use client';

import { useState, useEffect } from 'react';
import { Save, Trash2, Download, Upload, FolderOpen, X } from 'lucide-react';
import { Position } from '@/lib/api';
import {
  SavedRoute,
  getRoutes,
  saveRoute,
  deleteRoute,
  exportRoutes,
  importRoutes,
} from '@/lib/routeStorage';

interface SavedRoutesProps {
  currentWaypoints: Position[];
  onLoadRoute: (waypoints: Position[]) => void;
}

export default function SavedRoutes({ currentWaypoints, onLoadRoute }: SavedRoutesProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load routes on mount
  useEffect(() => {
    setRoutes(getRoutes());
  }, []);

  const handleSave = () => {
    if (currentWaypoints.length < 2) {
      alert('Add at least 2 waypoints before saving');
      return;
    }
    setShowSaveDialog(true);
    setRouteName(`Route ${routes.length + 1}`);
  };

  const confirmSave = () => {
    const newRoute = saveRoute(routeName, currentWaypoints);
    setRoutes([...routes, newRoute]);
    setShowSaveDialog(false);
    setRouteName('');
  };

  const handleLoad = (route: SavedRoute) => {
    onLoadRoute(route.waypoints);
    setIsExpanded(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this route?')) {
      deleteRoute(id);
      setRoutes(routes.filter(r => r.id !== id));
    }
  };

  const handleExport = () => {
    exportRoutes();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const count = importRoutes(ev.target?.result as string);
          if (count > 0) {
            setRoutes(getRoutes());
            alert(`Imported ${count} routes`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={currentWaypoints.length < 2}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-maritime-dark hover:bg-white/10 text-gray-300 text-sm rounded-lg transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Load ({routes.length})</span>
        </button>
      </div>

      {/* Export/Import */}
      <div className="flex space-x-2">
        <button
          onClick={handleExport}
          disabled={routes.length === 0}
          className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors disabled:opacity-50"
        >
          <Download className="w-3 h-3" />
          <span>Export</span>
        </button>
        <button
          onClick={handleImport}
          className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
        >
          <Upload className="w-3 h-3" />
          <span>Import</span>
        </button>
      </div>

      {/* Saved routes list */}
      {isExpanded && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="bg-maritime-dark/50 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Saved Routes</span>
            <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {routes.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No saved routes
              </div>
            ) : (
              routes.map((route) => (
                <div
                  key={route.id}
                  className="flex items-center justify-between p-2 border-t border-white/5 hover:bg-white/5"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleLoad(route)}
                  >
                    <div className="text-sm text-white">{route.name}</div>
                    <div className="text-xs text-gray-500">
                      {route.waypoints.length} waypoints
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(route.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-maritime-dark border border-white/10 rounded-xl p-6 w-80">
            <h3 className="text-lg font-semibold text-white mb-4">Save Route</h3>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Route name"
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              autoFocus
            />
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                className="flex-1 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
