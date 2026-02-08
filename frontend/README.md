# WINDMAR Frontend

Beautiful Next.js web application for maritime route optimization, inspired by Syroco's professional design.

## Features

- 🗺️ **Interactive Route Planning** - Optimize routes with real-time weather data
- 📊 **Fuel Analysis Dashboard** - Compare fuel consumption across scenarios
- ⚙️ **Vessel Configuration** - Customize vessel specifications
- 🌊 **Weather Integration** - Real-time NOAA GFS and WaveWatch III data
- 📈 **Performance Charts** - Visual fuel breakdown and optimization insights
- 🎨 **Beautiful UI** - Syroco-inspired maritime design with dark theme

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom maritime theme
- **Maps**: React Leaflet
- **Charts**: Recharts
- **API Client**: Axios with React Query
- **Icons**: Lucide React

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- WINDMAR backend API running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Route optimization page
│   ├── fuel-analysis/     # Fuel analysis page
│   └── vessel-config/     # Vessel configuration page
├── components/            # Reusable components
│   ├── Header.tsx        # Navigation header
│   ├── RouteMap.tsx      # Interactive map
│   ├── Card.tsx          # Card components
│   └── FuelChart.tsx     # Fuel charts
└── lib/                  # Utilities
    ├── api.ts            # API client
    └── utils.ts          # Helper functions
```

## Features Overview

### 1. Route Optimization

- Select from predefined routes (ARA-MED, Transatlantic, Mediterranean)
- Choose loading condition (Laden/Ballast)
- Toggle weather routing on/off
- View optimized route on interactive map
- See fuel consumption breakdown

### 2. Fuel Analysis

- Compare fuel scenarios (calm vs. rough seas)
- Weather impact analysis
- Optimization opportunities
- Visual fuel breakdown charts

### 3. Vessel Configuration

- Configure vessel dimensions (DWT, LOA, Beam, Draft)
- Set engine specifications (MCR, SFOC)
- Define service speeds
- Save custom configurations

## API Integration

The frontend communicates with the FastAPI backend:

```typescript
import { apiClient } from '@/lib/api';

// Optimize route
const route = await apiClient.optimizeRoute({
  start: { latitude: 51.9225, longitude: 4.4792 },
  end: { latitude: 37.2333, longitude: 15.2167 },
  is_laden: true,
  use_weather: true,
});

// Calculate fuel
const fuel = await apiClient.calculateFuel({
  speed_kts: 14.5,
  is_laden: true,
  wind_speed_ms: 10.0,
});
```

## Design System

### Colors

- **Primary Blue**: `#0073e6` - Primary actions and highlights
- **Ocean Teal**: `#008ba2` - Secondary elements
- **Maritime Dark**: `#0a1628` - Background base
- **Maritime Light**: `#1a2942` - Card backgrounds

### Components

All components follow the maritime theme with:
- Glass morphism effects
- Smooth animations
- Professional typography
- Consistent spacing

## Development

```bash
# Run dev server with live reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari 14+

## Performance

- Server-side rendering for fast initial load
- Code splitting for optimal bundle size
- Image optimization
- Lazy loading for maps and charts

## Troubleshooting

### Map not displaying

Ensure Leaflet CSS is loaded and component is client-side only:
```typescript
const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
});
```

### API connection failed

- Check backend is running on port 8000
- Verify CORS settings allow localhost:3000
- Check `.env.local` has correct API URL

### Build errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

## Contributing

1. Follow TypeScript strict mode
2. Use Tailwind classes (avoid custom CSS)
3. Test on multiple viewports
4. Ensure accessibility (ARIA labels, keyboard nav)
5. Update documentation

## License

Apache 2.0 - See [LICENSE](../LICENSE)

## Support

For issues or questions:
- Check API documentation at `http://localhost:8000/api/docs`
- Review browser console for errors
- Ensure backend is running and accessible
