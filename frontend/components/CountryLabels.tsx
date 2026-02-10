'use client';

import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

// Country label centroids — covers major maritime-relevant countries
const COUNTRIES: { name: string; lat: number; lon: number; minZoom: number }[] = [
  // Europe
  { name: 'Norway', lat: 64.5, lon: 11.0, minZoom: 4 },
  { name: 'Sweden', lat: 62.0, lon: 16.0, minZoom: 4 },
  { name: 'Finland', lat: 63.0, lon: 26.0, minZoom: 4 },
  { name: 'Denmark', lat: 56.0, lon: 9.5, minZoom: 5 },
  { name: 'Iceland', lat: 65.0, lon: -18.5, minZoom: 4 },
  { name: 'United Kingdom', lat: 54.0, lon: -2.5, minZoom: 4 },
  { name: 'Ireland', lat: 53.5, lon: -8.0, minZoom: 5 },
  { name: 'France', lat: 46.5, lon: 2.5, minZoom: 4 },
  { name: 'Spain', lat: 40.0, lon: -3.5, minZoom: 4 },
  { name: 'Portugal', lat: 39.5, lon: -8.0, minZoom: 5 },
  { name: 'Italy', lat: 42.5, lon: 12.5, minZoom: 4 },
  { name: 'Germany', lat: 51.0, lon: 10.5, minZoom: 4 },
  { name: 'Netherlands', lat: 52.3, lon: 5.5, minZoom: 5 },
  { name: 'Belgium', lat: 50.8, lon: 4.5, minZoom: 6 },
  { name: 'Poland', lat: 52.0, lon: 19.5, minZoom: 4 },
  { name: 'Greece', lat: 39.0, lon: 22.0, minZoom: 5 },
  { name: 'Turkey', lat: 39.0, lon: 35.0, minZoom: 4 },
  { name: 'Romania', lat: 46.0, lon: 25.0, minZoom: 5 },
  { name: 'Ukraine', lat: 49.0, lon: 32.0, minZoom: 4 },
  { name: 'Croatia', lat: 45.0, lon: 16.0, minZoom: 6 },
  { name: 'Switzerland', lat: 46.8, lon: 8.2, minZoom: 6 },
  { name: 'Austria', lat: 47.5, lon: 14.5, minZoom: 6 },
  { name: 'Czech Republic', lat: 49.8, lon: 15.5, minZoom: 6 },

  // Mediterranean & Middle East
  { name: 'Morocco', lat: 32.0, lon: -6.0, minZoom: 4 },
  { name: 'Algeria', lat: 28.0, lon: 2.5, minZoom: 4 },
  { name: 'Tunisia', lat: 34.0, lon: 9.5, minZoom: 5 },
  { name: 'Libya', lat: 27.0, lon: 17.0, minZoom: 4 },
  { name: 'Egypt', lat: 26.5, lon: 30.0, minZoom: 4 },
  { name: 'Israel', lat: 31.5, lon: 35.0, minZoom: 6 },
  { name: 'Lebanon', lat: 33.9, lon: 35.8, minZoom: 7 },
  { name: 'Syria', lat: 35.0, lon: 38.0, minZoom: 5 },
  { name: 'Saudi Arabia', lat: 24.0, lon: 44.0, minZoom: 4 },
  { name: 'UAE', lat: 24.0, lon: 54.0, minZoom: 5 },
  { name: 'Oman', lat: 21.0, lon: 57.0, minZoom: 5 },
  { name: 'Yemen', lat: 15.5, lon: 47.5, minZoom: 5 },
  { name: 'Iran', lat: 33.0, lon: 53.0, minZoom: 4 },
  { name: 'Iraq', lat: 33.0, lon: 44.0, minZoom: 5 },

  // Africa
  { name: 'Mauritania', lat: 20.0, lon: -10.0, minZoom: 4 },
  { name: 'Senegal', lat: 14.5, lon: -14.5, minZoom: 5 },
  { name: 'Nigeria', lat: 9.0, lon: 8.0, minZoom: 4 },
  { name: 'Ghana', lat: 7.5, lon: -1.5, minZoom: 5 },
  { name: 'Cameroon', lat: 6.0, lon: 12.5, minZoom: 5 },
  { name: 'Congo', lat: -1.0, lon: 15.5, minZoom: 5 },
  { name: 'DR Congo', lat: -3.0, lon: 23.5, minZoom: 4 },
  { name: 'Angola', lat: -12.5, lon: 18.5, minZoom: 4 },
  { name: 'Namibia', lat: -22.0, lon: 17.0, minZoom: 4 },
  { name: 'South Africa', lat: -30.0, lon: 25.0, minZoom: 4 },
  { name: 'Mozambique', lat: -18.0, lon: 35.0, minZoom: 4 },
  { name: 'Tanzania', lat: -6.5, lon: 35.0, minZoom: 4 },
  { name: 'Kenya', lat: 0.5, lon: 38.0, minZoom: 5 },
  { name: 'Somalia', lat: 5.0, lon: 46.0, minZoom: 4 },
  { name: 'Ethiopia', lat: 9.0, lon: 39.5, minZoom: 4 },
  { name: 'Sudan', lat: 16.0, lon: 30.0, minZoom: 4 },
  { name: 'Madagascar', lat: -19.0, lon: 47.0, minZoom: 4 },

  // Asia
  { name: 'India', lat: 22.0, lon: 79.0, minZoom: 3 },
  { name: 'Pakistan', lat: 30.0, lon: 69.0, minZoom: 4 },
  { name: 'China', lat: 35.0, lon: 103.0, minZoom: 3 },
  { name: 'Japan', lat: 36.5, lon: 138.0, minZoom: 4 },
  { name: 'South Korea', lat: 36.0, lon: 128.0, minZoom: 5 },
  { name: 'North Korea', lat: 40.0, lon: 127.0, minZoom: 5 },
  { name: 'Vietnam', lat: 16.0, lon: 106.0, minZoom: 5 },
  { name: 'Thailand', lat: 15.0, lon: 101.0, minZoom: 5 },
  { name: 'Myanmar', lat: 20.0, lon: 96.0, minZoom: 5 },
  { name: 'Malaysia', lat: 3.5, lon: 109.0, minZoom: 5 },
  { name: 'Indonesia', lat: -2.0, lon: 118.0, minZoom: 3 },
  { name: 'Philippines', lat: 12.0, lon: 122.0, minZoom: 4 },
  { name: 'Bangladesh', lat: 24.0, lon: 90.0, minZoom: 5 },
  { name: 'Sri Lanka', lat: 7.5, lon: 80.8, minZoom: 6 },
  { name: 'Singapore', lat: 1.35, lon: 103.8, minZoom: 7 },
  { name: 'Taiwan', lat: 23.7, lon: 121.0, minZoom: 6 },

  // Russia & Central Asia
  { name: 'Russia', lat: 62.0, lon: 95.0, minZoom: 3 },
  { name: 'Kazakhstan', lat: 48.0, lon: 67.0, minZoom: 4 },

  // Americas
  { name: 'Canada', lat: 57.0, lon: -96.0, minZoom: 3 },
  { name: 'United States', lat: 39.0, lon: -98.0, minZoom: 3 },
  { name: 'Mexico', lat: 23.5, lon: -102.0, minZoom: 4 },
  { name: 'Cuba', lat: 22.0, lon: -79.5, minZoom: 5 },
  { name: 'Colombia', lat: 4.5, lon: -73.0, minZoom: 4 },
  { name: 'Venezuela', lat: 8.0, lon: -66.0, minZoom: 4 },
  { name: 'Brazil', lat: -10.0, lon: -52.0, minZoom: 3 },
  { name: 'Argentina', lat: -35.0, lon: -65.0, minZoom: 3 },
  { name: 'Chile', lat: -33.0, lon: -71.0, minZoom: 4 },
  { name: 'Peru', lat: -10.0, lon: -76.0, minZoom: 4 },
  { name: 'Panama', lat: 8.5, lon: -80.0, minZoom: 6 },

  // Oceania
  { name: 'Australia', lat: -25.0, lon: 134.0, minZoom: 3 },
  { name: 'New Zealand', lat: -42.0, lon: 172.0, minZoom: 4 },
  { name: 'Papua New Guinea', lat: -6.5, lon: 147.0, minZoom: 5 },

  // Greenland
  { name: 'Greenland', lat: 72.0, lon: -42.0, minZoom: 3 },
];

export default function CountryLabels() {
  const map = useMap();

  useEffect(() => {
    const markers: L.Marker[] = [];

    COUNTRIES.forEach((country) => {
      const icon = L.divIcon({
        className: 'country-label',
        html: `<span>${country.name}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([country.lat, country.lon], {
        icon,
        interactive: false,
        keyboard: false,
      });

      markers.push(marker);
    });

    // Show/hide based on zoom
    const updateVisibility = () => {
      const zoom = map.getZoom();
      markers.forEach((marker, i) => {
        const country = COUNTRIES[i];
        if (zoom >= country.minZoom) {
          if (!map.hasLayer(marker)) marker.addTo(map);
        } else {
          if (map.hasLayer(marker)) map.removeLayer(marker);
        }
      });
    };

    updateVisibility();
    map.on('zoomend', updateVisibility);

    return () => {
      map.off('zoomend', updateVisibility);
      markers.forEach((marker) => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      });
    };
  }, [map]);

  return null;
}
