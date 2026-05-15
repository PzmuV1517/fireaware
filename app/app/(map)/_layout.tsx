import { Slot } from "expo-router";

import { MapShell } from "@/components/MapShell";

/**
 * Persistent map layout. /index and /mission-control share a single MapView
 * instance via MapShell so switching between them doesn't reload the map.
 */
export default function MapGroupLayout() {
  return (
    <MapShell>
      <Slot />
    </MapShell>
  );
}
