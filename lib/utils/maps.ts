// lib/utils/maps.ts

async function resolveAndFetchGmapsContent(url: string): Promise<string> {
  if (!url) return '';
  if (!url.includes('goo.gl') && !url.includes('maps.app.goo.gl')) {
    return url;
  }

  try {
    const res = await fetch(url, { 
      method: 'GET', 
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const finalUrl = res.url || '';
    const htmlText = await res.text();
    return `${finalUrl} ${htmlText}`;
  } catch (err) {
    console.error('Error resolving short URL:', err);
    return url;
  }
}

function extractCoordsFromText(text: string): { lat: number; lon: number } | null {
  if (!text) return null;
  
  const pinMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) return { lat: parseFloat(pinMatch[1]), lon: parseFloat(pinMatch[2]) };

  const centerMatch = text.match(/center=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (centerMatch) return { lat: parseFloat(centerMatch[1]), lon: parseFloat(centerMatch[2]) };

  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };

  const qMatch = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };

  const placeMatch = text.match(/\/place\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (placeMatch) return { lat: parseFloat(placeMatch[1]), lon: parseFloat(placeMatch[2]) };

  return null;
}

// OSRM Routing + Geometry Fetcher
async function getOsrmRouteData(lat1: number, lon1: number, lat2: number, lon2: number): Promise<{ distanceKm: number; geometry: [number, number][] }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const meters = data.routes[0].distance;
      const km = Math.round((meters / 1000) * 10) / 10;
      // Convert OSRM [lon, lat] to Leaflet [lat, lon]
      const geometry = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
      return { distanceKm: km, geometry };
    }
  } catch (err) {
    console.error('OSRM Routing Error, falling back to Haversine:', err);
  }

  // Fallback Haversine math
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const rawKm = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  const distanceKm = Math.round((rawKm * 1.2) * 10) / 10;

  return { distanceKm, geometry: [[lat1, lon1], [lat2, lon2]] };
}

export async function calculateDistanceAndFee(
  pickupAddress: string,
  dropoffAddress: string,
  pickupGmapsUrl?: string,
  dropoffGmapsUrl?: string
): Promise<{ 
  distanceKm: number; 
  deliveryFee: number; 
  pickupCoords: { lat: number; lon: number } | null; 
  dropoffCoords: { lat: number; lon: number } | null;
  routeGeometry: [number, number][];
}> {
  const pickupContent = await resolveAndFetchGmapsContent(pickupGmapsUrl || '');
  const dropoffContent = await resolveAndFetchGmapsContent(dropoffGmapsUrl || '');

  const pickupCoords = extractCoordsFromText(pickupContent);
  const dropoffCoords = extractCoordsFromText(dropoffContent);

  if (!pickupCoords || !dropoffCoords) {
    throw new Error(`Unable to extract precise coordinates from Google Maps links. Pickup found: ${!!pickupCoords}, Dropoff found: ${!!dropoffCoords}`);
  }

  const { distanceKm, geometry } = await getOsrmRouteData(
    pickupCoords.lat,
    pickupCoords.lon,
    dropoffCoords.lat,
    dropoffCoords.lon
  );

  const baseFee = 50;
  const perKmRate = 12;
  const deliveryFee = Math.round(baseFee + distanceKm * perKmRate);

  return {
    distanceKm: Math.max(1, distanceKm),
    deliveryFee: Math.max(baseFee, deliveryFee),
    pickupCoords,
    dropoffCoords,
    routeGeometry: geometry,
  };
}