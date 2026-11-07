// components/RiderMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RiderMapProps {
  pickupCoords: { lat: number; lon: number } | null;
  dropoffCoords: { lat: number; lon: number } | null;
  routeGeometry: [number, number][];
}

export default function RiderMap({ pickupCoords, dropoffCoords, routeGeometry }: RiderMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Fallback: Extract coordinates from routeGeometry if props are null
    const effectivePickup = pickupCoords || (routeGeometry.length > 0 ? { lat: routeGeometry[0][0], lon: routeGeometry[0][1] } : null);
    const effectiveDropoff = dropoffCoords || (routeGeometry.length > 0 ? { lat: routeGeometry[routeGeometry.length - 1][0], lon: routeGeometry[routeGeometry.length - 1][1] } : null);

    if (!effectivePickup || !effectiveDropoff) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([effectivePickup.lat, effectivePickup.lon], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Clear previous markers and route lines before adding updated ones
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    L.marker([effectivePickup.lat, effectivePickup.lon])
      .addTo(map)
      .bindPopup('<b>Store Pickup</b>');

    L.marker([effectiveDropoff.lat, effectiveDropoff.lon])
      .addTo(map)
      .bindPopup('<b>Customer Drop-off</b>');

    const pathCoords = routeGeometry.length > 0 
      ? routeGeometry 
      : [[effectivePickup.lat, effectivePickup.lon], [effectiveDropoff.lat, effectiveDropoff.lon]];

    const routePolyline = L.polyline(pathCoords as any, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

  }, [pickupCoords, dropoffCoords, routeGeometry]);

  // Cleanup map instance on unmount to prevent container reuse errors
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-64 rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0" 
    />
  );
}