// components/AdminCommandMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons for Next.js Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Color palette to distinguish multiple active rider routes
const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

interface AdminCommandMapProps {
  activeOrders: any[];
}

export default function AdminCommandMap({ activeOrders }: AdminCommandMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map centered around default region if not already created
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([15.145, 120.977], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Force Leaflet to recalculate size inside dynamic containers
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Clear existing markers and polylines on data updates
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds([]);

    activeOrders.forEach((order, index) => {
      const { pickupCoords, dropoffCoords, routeGeometry, orderNumber, customerName, status, currentRiderId } = order;
      const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];
      const riderName = currentRiderId?.name || 'Unassigned Rider';

      // 1. Plot Pickup Marker
      if (pickupCoords?.lat && pickupCoords?.lon) {
        L.marker([pickupCoords.lat, pickupCoords.lon])
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px;">
              <b>📍 Pickup (${orderNumber})</b><br/>
              <b>Rider:</b> ${riderName}<br/>
              <b>Customer:</b> ${customerName}<br/>
              <b>Status:</b> ${status}
            </div>
          `);
        bounds.extend([pickupCoords.lat, pickupCoords.lon]);
      }

      // 2. Plot Drop-off Marker
      if (dropoffCoords?.lat && dropoffCoords?.lon) {
        L.marker([dropoffCoords.lat, dropoffCoords.lon])
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px;">
              <b>🏁 Drop-off (${orderNumber})</b><br/>
              <b>Rider:</b> ${riderName}<br/>
              <b>Customer:</b> ${customerName}
            </div>
          `);
        bounds.extend([dropoffCoords.lat, dropoffCoords.lon]);
      }

      // 3. Render OSRM Route Polyline for this specific active order
      const pathCoords = routeGeometry && routeGeometry.length > 0
        ? routeGeometry
        : (pickupCoords?.lat && dropoffCoords?.lat 
            ? [[pickupCoords.lat, pickupCoords.lon], [dropoffCoords.lat, dropoffCoords.lon]] 
            : []);

      if (pathCoords.length > 0) {
        L.polyline(pathCoords as any, {
          color: routeColor,
          weight: 5,
          opacity: 0.8,
        }).addTo(map);
      }
    });

    // Fit map view to frame ALL active riders & destinations
    if (activeOrders.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [activeOrders]);

  // Cleanup map instance on unmount
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
      className="w-full h-[500px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl z-0" 
    />
  );
}