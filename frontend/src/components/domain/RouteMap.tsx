import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Geometry } from 'geojson';

import 'leaflet/dist/leaflet.css';

import { cn } from '@/lib/cn';

export interface MapPoint {
  latitude: number;
  longitude: number;
  label: string;
  kind: 'origin' | 'destination' | 'pickup' | 'drop';
}

interface RouteMapProps {
  // Raw GeoJSON from the ride's `routeGeometry`, exactly as the map provider
  // returned it.
  geometry: Geometry;
  points: MapPoint[];
  className?: string;
}

// Leaflet's default marker icons are resolved from a CDN path that a bundler
// rewrites, so they 404 silently. Small inline SVG pins avoid the problem
// entirely and let the two point types be told apart by colour.
const PIN_COLORS: Record<MapPoint['kind'], string> = {
  origin: '#0f766e',
  destination: '#0f766e',
  // The passenger's own points sit on top of the driver's route and must not
  // be mistaken for it.
  pickup: '#b45309',
  drop: '#b45309',
};

function pinIcon(kind: MapPoint['kind']): L.DivIcon {
  const color = PIN_COLORS[kind];
  const hollow = kind === 'destination' || kind === 'drop';

  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;
      background:${hollow ? '#ffffff' : color};border:4px solid ${color};
      box-shadow:0 0 0 2px rgba(255,255,255,0.9)"></span>`,
  });
}

// Geoapify tiles when a key is configured, OpenStreetMap otherwise so the map
// still renders in a fresh checkout with no setup.
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_TILE_KEY as string | undefined;

const TILE_URL =
  GEOAPIFY_KEY !== undefined && GEOAPIFY_KEY.length > 0
    ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const TILE_ATTRIBUTION =
  GEOAPIFY_KEY !== undefined && GEOAPIFY_KEY.length > 0
    ? '© <a href="https://www.geoapify.com/">Geoapify</a> © OpenStreetMap contributors'
    : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Driven directly rather than through react-leaflet: the map is read-only and
// never re-renders from React state, so an imperative setup in one effect is
// simpler than a tree of wrapper components.
//
// This is one of only two places in Rydex with a map. It exists because the
// question a passenger actually has — "how far off this driver's route am
// I?" — is answered by seeing their two points against the line, and not by
// the "2.3 km" the search results already gave them.
export function RouteMap({ geometry, points, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = L.map(container, {
      // A route map inside a scrolling page should not swallow the wheel;
      // clicking the map enables zoom, which Leaflet handles for us.
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const route = L.geoJSON(geometry, {
      style: { color: '#0f766e', weight: 4, opacity: 0.85 },
    }).addTo(map);

    for (const point of points) {
      L.marker([point.latitude, point.longitude], { icon: pinIcon(point.kind) })
        .addTo(map)
        .bindTooltip(point.label, { direction: 'top', offset: [0, -8] });
    }

    // Fit the route and every marker, so a pickup far off the corridor stays
    // visible rather than being cropped out.
    const bounds = route.getBounds();
    for (const point of points) bounds.extend([point.latitude, point.longitude]);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32] });

    // The container is often sized by a parent that settles after mount
    // (a grid column, a just-opened panel); without this the tiles render
    // against a stale size and leave grey gaps.
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [geometry, points]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map showing the driver's route and your pickup and drop-off points"
      className={cn('h-64 w-full rounded-card border border-border-subtle sm:h-80', className)}
    />
  );
}
