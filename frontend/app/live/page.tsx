'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import TimeSeriesPanel, { LiveValuePanel } from '@/components/TimeSeriesPanel';
import VesselCompass from '@/components/VesselCompass';
import {
  Activity,
  Wifi,
  WifiOff,
  Play,
  Square,
  Settings,
  Anchor,
  Navigation,
  Gauge,
  Waves,
  Wind,
  RotateCcw,
} from 'lucide-react';
import {
  apiClient,
  LiveData,
  SensorStatus,
  createLiveWebSocket,
} from '@/lib/api';

// Dynamic import for map (client-side only)
const WindyMap = dynamic(() => import('@/components/WindyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-maritime-dark rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
    </div>
  ),
});

// Time series data buffer
interface TimeSeriesBuffer {
  timestamps: Date[];
  values: number[];
}

export default function LivePage() {
  // Connection state
  const [sensorStatus, setSensorStatus] = useState<SensorStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionType, setConnectionType] = useState<'simulator' | 'serial'>('simulator');

  // Live data
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // Time series buffers (keep last 5 minutes at 10Hz = 3000 points)
  const [sogBuffer, setSogBuffer] = useState<TimeSeriesBuffer>({ timestamps: [], values: [] });
  const [headingBuffer, setHeadingBuffer] = useState<TimeSeriesBuffer>({ timestamps: [], values: [] });
  const [rollBuffer, setRollBuffer] = useState<TimeSeriesBuffer>({ timestamps: [], values: [] });
  const [pitchBuffer, setPitchBuffer] = useState<TimeSeriesBuffer>({ timestamps: [], values: [] });
  const [heaveBuffer, setHeaveBuffer] = useState<TimeSeriesBuffer>({ timestamps: [], values: [] });

  // Track points for map
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);

  // Update buffer helper
  const updateBuffer = useCallback(
    (
      buffer: TimeSeriesBuffer,
      setBuffer: React.Dispatch<React.SetStateAction<TimeSeriesBuffer>>,
      value: number,
      maxAge: number = 300000 // 5 minutes
    ) => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - maxAge);

      setBuffer((prev) => {
        // Filter old points
        const filteredTs: Date[] = [];
        const filteredVals: number[] = [];
        for (let i = 0; i < prev.timestamps.length; i++) {
          if (prev.timestamps[i] > cutoff) {
            filteredTs.push(prev.timestamps[i]);
            filteredVals.push(prev.values[i]);
          }
        }

        // Add new point
        filteredTs.push(now);
        filteredVals.push(value);

        return { timestamps: filteredTs, values: filteredVals };
      });
    },
    []
  );

  // Fetch sensor status
  const fetchStatus = useCallback(async () => {
    try {
      const status = await apiClient.getSensorStatus();
      setSensorStatus(status);
    } catch (error) {
      console.error('Failed to fetch sensor status:', error);
    }
  }, []);

  // Connect to sensor
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await apiClient.connectSensor({
        connection_type: connectionType,
        port: '/dev/ttyUSB0',
        baudrate: 115200,
      });
      await fetchStatus();

      // Start WebSocket connection
      const ws = createLiveWebSocket(
        (data) => {
          setLiveData(data);

          // Update time series buffers
          updateBuffer(sogBuffer, setSogBuffer, data.velocity.sog_kts);
          updateBuffer(headingBuffer, setHeadingBuffer, data.attitude.heading_deg);
          updateBuffer(rollBuffer, setRollBuffer, data.attitude.roll_deg);
          updateBuffer(pitchBuffer, setPitchBuffer, data.attitude.pitch_deg);
          updateBuffer(heaveBuffer, setHeaveBuffer, data.motion.heave_m);

          // Update track (less frequently)
          if (Math.random() < 0.1) {
            // ~1Hz instead of 10Hz
            setTrackPoints((prev) => {
              const newPoints = [
                ...prev,
                [data.position.latitude, data.position.longitude] as [number, number],
              ];
              // Keep last 1000 points
              return newPoints.slice(-1000);
            });
          }
        },
        (error) => console.error('WebSocket error:', error),
        () => console.log('WebSocket closed')
      );
      setWebsocket(ws);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to sensor. Make sure the backend is running.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from sensor
  const handleDisconnect = async () => {
    try {
      if (websocket) {
        websocket.close();
        setWebsocket(null);
      }
      await apiClient.disconnectSensor();
      await fetchStatus();
      setLiveData(null);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);

  // Convert buffer to chart series format
  const bufferToSeries = (buffer: TimeSeriesBuffer, name: string, color: string, unit: string) => ({
    name,
    color,
    unit,
    data: buffer.timestamps.map((ts, i) => ({ time: ts, value: buffer.values[i] })),
  });

  return (
    <div className="min-h-screen bg-gradient-maritime">
      <Header />

      <main className="container mx-auto px-4 pt-20 pb-8">
        {/* Header Bar - like MIROS */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <Activity className="w-6 h-6 text-primary-400" />
              <span>Vessel and Weather</span>
            </h1>
            <div className="flex items-center space-x-2 text-sm">
              <button className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded">
                Wave
              </button>
              <button className="px-3 py-1 text-gray-400 hover:text-white rounded">
                Current
              </button>
            </div>
          </div>

          {/* Connection controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {sensorStatus?.connected ? (
                <div className="flex items-center space-x-2 text-green-400">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm">Connected ({sensorStatus.connection_type})</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-gray-400">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm">Disconnected</span>
                </div>
              )}
            </div>

            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as any)}
              disabled={sensorStatus?.connected}
              className="bg-maritime-dark border border-white/10 rounded px-2 py-1 text-sm text-white"
            >
              <option value="simulator">Simulator</option>
              <option value="serial">Serial (SBG)</option>
            </select>

            {sensorStatus?.connected ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center space-x-1 px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center space-x-1 px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>{isConnecting ? 'Connecting...' : 'Start'}</span>
              </button>
            )}

            {/* Time display like MIROS */}
            <div className="text-right text-xs text-gray-400">
              <div>Your time: {new Date().toLocaleString()}</div>
              <div>Ship time: {new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Main Grid - MIROS-inspired layout */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left column - Time series panels */}
          <div className="col-span-5 space-y-4">
            {/* Vessel Speed Panel */}
            <TimeSeriesPanel
              title="Vessel speed"
              series={[
                bufferToSeries(sogBuffer, 'SOG (GPS)', '#fbbf24', 'kn'),
              ]}
              currentValues={[
                {
                  name: 'SOG (GPS)',
                  value: liveData?.velocity.sog_kts ?? 0,
                  unit: 'kn',
                  color: '#fbbf24',
                },
              ]}
              height={150}
              timeRangeMinutes={5}
            />

            {/* Heading Panel */}
            <TimeSeriesPanel
              title="Heading"
              series={[
                bufferToSeries(headingBuffer, 'Heading', '#22d3ee', '°'),
              ]}
              currentValues={[
                {
                  name: 'Heading',
                  value: liveData?.attitude.heading_deg ?? 0,
                  unit: '°',
                  color: '#22d3ee',
                },
              ]}
              height={120}
              timeRangeMinutes={5}
              yAxisDomain={[0, 360]}
            />

            {/* Roll/Pitch Panel */}
            <TimeSeriesPanel
              title="Roll and Pitch"
              series={[
                bufferToSeries(rollBuffer, 'Roll', '#f97316', '°'),
                bufferToSeries(pitchBuffer, 'Pitch', '#a855f7', '°'),
              ]}
              currentValues={[
                {
                  name: 'Roll',
                  value: liveData?.attitude.roll_deg ?? 0,
                  unit: '°',
                  color: '#f97316',
                },
                {
                  name: 'Pitch',
                  value: liveData?.attitude.pitch_deg ?? 0,
                  unit: '°',
                  color: '#a855f7',
                },
              ]}
              height={150}
              timeRangeMinutes={5}
            />

            {/* Heave Panel */}
            <TimeSeriesPanel
              title="Heave"
              series={[
                bufferToSeries(heaveBuffer, 'Heave', '#10b981', 'm'),
              ]}
              currentValues={[
                {
                  name: 'Heave',
                  value: liveData?.motion.heave_m ?? 0,
                  unit: 'm',
                  color: '#10b981',
                },
              ]}
              height={120}
              timeRangeMinutes={5}
            />
          </div>

          {/* Right column - Map and compass */}
          <div className="col-span-7 space-y-4">
            {/* Map */}
            <WindyMap
              latitude={liveData?.position.latitude ?? 51.9225}
              longitude={liveData?.position.longitude ?? 4.4792}
              heading={liveData?.attitude.heading_deg ?? 0}
              sog={liveData?.velocity.sog_kts ?? 0}
              trackPoints={trackPoints}
              className="h-[400px]"
            />

            {/* Bottom row - Compass and stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Vessel Compass */}
              <VesselCompass
                heading={liveData?.attitude.heading_deg ?? 0}
                cog={liveData?.velocity.cog_deg ?? 0}
                rollAngle={liveData?.attitude.roll_deg ?? 0}
                pitchAngle={liveData?.attitude.pitch_deg ?? 0}
                vectors={[
                  // Example wind vector - in real implementation this would come from weather data
                  { name: 'Wind', direction: 45, color: '#3b82f6' },
                  { name: 'Wave', direction: 30, color: '#22c55e' },
                ]}
                size={220}
              />

              {/* Stats cards */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <LiveValuePanel
                    title="Position"
                    value={liveData?.position.latitude ?? 0}
                    unit="°N"
                    color="#22d3ee"
                    subtitle={`${(liveData?.position.longitude ?? 0).toFixed(4)}°E`}
                  />
                  <LiveValuePanel
                    title="GNSS Status"
                    value={liveData?.status.satellites ?? 0}
                    unit="sats"
                    color={
                      (liveData?.status.gnss_fix ?? 0) >= 4
                        ? '#22c55e'
                        : (liveData?.status.gnss_fix ?? 0) >= 2
                        ? '#fbbf24'
                        : '#ef4444'
                    }
                    subtitle={`HDOP: ${(liveData?.status.hdop ?? 99).toFixed(1)}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <LiveValuePanel
                    title="COG"
                    value={liveData?.velocity.cog_deg ?? 0}
                    unit="°"
                    color="#94a3b8"
                  />
                  <LiveValuePanel
                    title="Surge"
                    value={liveData?.motion.surge_m ?? 0}
                    unit="m"
                    color="#f97316"
                  />
                </div>

                {/* Motion severity indicator */}
                <div className="bg-maritime-dark/80 backdrop-blur-sm rounded-lg border border-white/10 p-4">
                  <div className="text-xs text-gray-400 mb-2">Motion Severity Index</div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                        style={{
                          width: `${Math.min(100, (Math.abs(liveData?.attitude.roll_deg ?? 0) + Math.abs(liveData?.motion.heave_m ?? 0) * 10) * 10)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-white tabular-nums">
                      {((Math.abs(liveData?.attitude.roll_deg ?? 0) + Math.abs(liveData?.motion.heave_m ?? 0) * 10) / 2).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
