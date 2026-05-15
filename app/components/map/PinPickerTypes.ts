export interface LatLon {
  lat: number;
  lon: number;
}

export interface PinPickerProps {
  start: { lat: number; lon: number; delta: number };
  observer: LatLon | null;
  target: LatLon | null;
  onTap: (coord: LatLon) => void;
}
