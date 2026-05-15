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
