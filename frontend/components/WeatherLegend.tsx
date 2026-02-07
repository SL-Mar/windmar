'use client';

interface WeatherLegendProps {
  mode: 'wind' | 'waves';
}

const WIND_STOPS = [
  { value: 0, color: 'rgb(30,80,220)' },
  { value: 5, color: 'rgb(0,200,220)' },
  { value: 10, color: 'rgb(0,200,50)' },
  { value: 15, color: 'rgb(240,220,0)' },
  { value: 20, color: 'rgb(240,130,0)' },
  { value: 25, color: 'rgb(220,30,30)' },
];

const WAVE_STOPS = [
  { value: 0, color: 'rgb(0,200,50)' },
  { value: 1, color: 'rgb(240,220,0)' },
  { value: 2, color: 'rgb(240,130,0)' },
  { value: 3, color: 'rgb(220,30,30)' },
  { value: 5, color: 'rgb(128,0,0)' },
];

function buildGradient(stops: { value: number; color: string }[]): string {
  const max = stops[stops.length - 1].value;
  const parts = stops.map(
    (s) => `${s.color} ${(s.value / max) * 100}%`
  );
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export default function WeatherLegend({ mode }: WeatherLegendProps) {
  const stops = mode === 'wind' ? WIND_STOPS : WAVE_STOPS;
  const unit = mode === 'wind' ? 'm/s' : 'm';
  const label = mode === 'wind' ? 'Wind Speed' : 'Wave Height';
  const gradient = buildGradient(stops);

  return (
    <div className="absolute bottom-4 right-4 bg-maritime-dark/90 backdrop-blur-sm rounded-lg p-3 z-[1000] min-w-[180px]">
      <div className="text-xs text-gray-400 mb-2 font-medium">
        {label} ({unit})
      </div>
      <div
        className="h-3 rounded-sm"
        style={{ background: gradient }}
      />
      <div className="flex justify-between mt-1">
        {stops.map((s) => (
          <span key={s.value} className="text-[10px] text-gray-300">
            {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}
