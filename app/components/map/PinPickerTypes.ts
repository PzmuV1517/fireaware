export interface LatLon {
  lat: number;
  lon: number;
}

export interface PinPickerProps {
  start: { lat: number; lon: number; delta: number };
  /** Observer / "you are here" pin. Placed on first tap. */
  observer: LatLon | null;
  /** Current aim coordinate — used to compute the bearing line direction.
   * The line itself is drawn at a fixed standard length, not to this coord. */
  aim: LatLon | null;
  /** Fired on tap. Before observer is placed → caller should set observer.
   * After → caller should update aim. */
  onTap: (coord: LatLon) => void;
  /** Fired continuously while finger drags across the map after observer is
   * placed (map scrolling is disabled in that mode). */
  onPan: (coord: LatLon) => void;
}
