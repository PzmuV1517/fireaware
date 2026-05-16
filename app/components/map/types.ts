export interface FireMarker {
  id: string;
  lat: number;
  lon: number;
  confidence: number;
  reportCount: number;
}

export interface ReportMarker {
  id: string;
  lat: number;
  lon: number;
  bearingDeg: number;
  matched: boolean;
}

export interface PinOverlay {
  observer: { lat: number; lon: number } | null;
  target: { lat: number; lon: number } | null;
  onMapClick: (coord: { lat: number; lon: number }) => void;
}

export interface FireZoneMarker {
  id: string;
  coordinates: [number, number][];  // [lon, lat] pairs
  label?: string | null;
  color: string;
}

export interface WaterReserveMarker {
  id: string;
  lat: number;
  lon: number;
  name: string;
}

export interface PropagationRing {
  /** Expanded polygon ring coordinates [lon, lat][]. */
  coordinates: [number, number][];
  /** Hours ahead this ring represents. */
  hours: number;
  /** Fill/stroke colour for this ring. */
  color: string;
}

/**
 * Expands every vertex of a polygon radially outward from its centroid by
 * `bufferM` metres. Works well for convex and mildly concave polygons.
 */
export function expandPolygon(
  coords: [number, number][],
  bufferM: number,
): [number, number][] {
  const { lat: clat, lon: clon } = polygonCentroid(coords);
  return coords.map(([lon, lat]) => {
    const bearing = bearingBetween(clat, clon, lat, lon);
    const dist = haversineM(clat, clon, lat, lon);
    const p = offsetPoint(clat, clon, bearing, dist + bufferM);
    return [p.lon, p.lat] as [number, number];
  });
}

export interface CuttingLineMarker {
  id: string;
  coordinates: [number, number][];
  label?: string | null;
  range_m: number;
}

/**
 * Builds a corridor polygon around a linestring by offsetting each vertex
 * perpendicularly by `rangeM` metres and returning a closed ring suitable for
 * a GeoJSON Polygon geometry (coordinates[0]).
 */
export function lineCorridorRing(
  coords: [number, number][],
  rangeM: number,
): [number, number][] {
  if (coords.length < 2 || rangeM <= 0) return [];

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];

    let bearing: number;
    if (i === 0) {
      bearing = bearingBetween(lat, lon, coords[1][1], coords[1][0]);
    } else if (i === coords.length - 1) {
      bearing = bearingBetween(coords[i - 1][1], coords[i - 1][0], lat, lon);
    } else {
      const b1 = bearingBetween(coords[i - 1][1], coords[i - 1][0], lat, lon);
      const b2 = bearingBetween(lat, lon, coords[i + 1][1], coords[i + 1][0]);
      let diff = b2 - b1;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      bearing = (b1 + diff / 2 + 360) % 360;
    }

    const lp = offsetPoint(lat, lon, (bearing - 90 + 360) % 360, rangeM);
    const rp = offsetPoint(lat, lon, (bearing + 90) % 360, rangeM);
    left.push([lp.lon, lp.lat]);
    right.push([rp.lon, rp.lat]);
  }

  const ring: [number, number][] = [...left, ...right.reverse()];
  ring.push(ring[0]);
  return ring;
}

/** A wind sample anchored to a fire. `flowDeg` is the direction the smoke is
 * moving TOWARD (compass degrees, 0=N), already inverted from the
 * meteorological "wind from" convention by the caller. */
export interface FireWind {
  fireId: string;
  lat: number;
  lon: number;
  flowDeg: number;
  speedKmh: number;
}

export interface MapViewProps {
  fires: FireMarker[];
  reports?: ReportMarker[];
  showReports?: boolean;
  pin?: PinOverlay;
  /** Bumping this forces all sync effects to re-apply data. Use after
   * actions whose new data might be structurally shared by React Query and
   * therefore wouldn't otherwise re-trigger effects. */
  redrawTick?: number;
  initialCenter?: { lat: number; lon: number };
  initialZoom?: number;
  onSelectFire?: (id: string) => void;
  onLongPress?: (lat: number, lon: number) => void;
  fireZones?: FireZoneMarker[];
  drawingPoints?: [number, number][];  // live polygon vertices [lon, lat], only used on web
  onMapClick?: (coord: { lat: number; lon: number }) => void;
  waterReserves?: WaterReserveMarker[];
  /** Show a connecting line from each fire to its closest active water reserve. */
  showClosestWater?: boolean;
  /** MapLibre style URL. Defaults to the positron style. */
  styleUrl?: string;
  /** Hide all POI icon/label layers after the style loads. */
  hidePois?: boolean;
  cuttingLines?: CuttingLineMarker[];
  propagationRings?: PropagationRing[];
  /** Wind samples — one per active fire — used to render a small grid of
   * smoke-direction arrows around each fire. */
  fireWinds?: FireWind[];
}

/** Returns a flat list of grid points filling a CIRCLE centred on (lat, lon).
 * Generates a (2*radiusSteps+1) square lattice with `stepM` spacing, then
 * keeps only the points within `radiusSteps * stepM` metres of the centre —
 * giving the field a round footprint instead of a square one. */
export function windGrid(
  lat: number,
  lon: number,
  radiusSteps: number,
  stepM: number,
): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  const radiusM = radiusSteps * stepM;
  for (let i = -radiusSteps; i <= radiusSteps; i++) {
    for (let j = -radiusSteps; j <= radiusSteps; j++) {
      const dx = j * stepM; // east offset
      const dy = i * stepM; // north offset
      const dist = Math.hypot(dx, dy);
      if (dist > radiusM) continue;
      if (dist === 0) {
        pts.push({ lat, lon });
        continue;
      }
      // bearing from north, clockwise; atan2(east, north)
      const brg = (Math.atan2(dx, dy) * 180) / Math.PI;
      pts.push(offsetPoint(lat, lon, brg, dist));
    }
  }
  return pts;
}

const EARTH_R = 6_371_000;

/** Point at `distance_m` along `bearing_deg` from (lat, lon). */
export function offsetPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number,
): { lat: number; lon: number } {
  const brg = (bearingDeg * Math.PI) / 180;
  const d = distanceM / EARTH_R;
  const phi1 = (lat * Math.PI) / 180;
  const lam1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(brg));
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    );
  return { lat: (phi2 * 180) / Math.PI, lon: (lam2 * 180) / Math.PI };
}

export const BEARING_LINE_M = 3000;

/** Great-circle distance in metres between two points. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLam = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Centroid of a polygon ring (simple coordinate mean — adequate for labels). */
export function polygonCentroid(coords: [number, number][]): { lat: number; lon: number } {
  let sx = 0;
  let sy = 0;
  for (const [lon, lat] of coords) {
    sx += lon;
    sy += lat;
  }
  const n = coords.length || 1;
  return { lon: sx / n, lat: sy / n };
}

/** Topmost (max-latitude) vertex of a polygon — used to anchor labels just above the zone. */
export function polygonTop(coords: [number, number][]): { lat: number; lon: number } {
  if (coords.length === 0) return { lat: 0, lon: 0 };
  let max = coords[0];
  for (const c of coords) if (c[1] > max[1]) max = c;
  return { lat: max[1], lon: max[0] };
}

/** Initial-bearing from p1 to p2 along the great circle, in degrees [0, 360). */
export function bearingBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLam = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
