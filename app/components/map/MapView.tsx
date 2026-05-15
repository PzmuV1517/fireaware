import RNMapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

import { BEARING_LINE_M, offsetPoint } from "./types";
import type { MapViewProps } from "./types";

export function MapView({
  fires,
  reports,
  showReports,
  initialCenter,
  initialZoom = 6,
  onSelectFire,
}: MapViewProps) {
  const center = initialCenter ?? { lat: 38.7223, lon: -9.1393 };
  const delta = zoomToDelta(initialZoom);

  return (
    <RNMapView
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lon,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
    >
      {showReports &&
        (reports ?? []).map((r) => {
          const end = offsetPoint(r.lat, r.lon, r.bearingDeg, BEARING_LINE_M);
          return (
            <Polyline
              key={`line-${r.id}`}
              coordinates={[
                { latitude: r.lat, longitude: r.lon },
                { latitude: end.lat, longitude: end.lon },
              ]}
              strokeColor={r.matched ? colors.accent : colors.inkMuted}
              strokeWidth={r.matched ? 2 : 1.5}
              lineDashPattern={r.matched ? undefined : [4, 4]}
            />
          );
        })}

      {showReports &&
        (reports ?? []).map((r) => (
          <Marker
            key={`rep-${r.id}`}
            identifier={`rep-${r.id}`}
            coordinate={{ latitude: r.lat, longitude: r.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: r.matched ? colors.accent : "#FFFFFF",
                borderWidth: 1.5,
                borderColor: r.matched ? "#FFFFFF" : colors.inkMuted,
              }}
            />
          </Marker>
        ))}

      {fires.map((f) => (
        <Marker
          key={f.id}
          identifier={f.id}
          coordinate={{ latitude: f.lat, longitude: f.lon }}
          onPress={() => onSelectFire?.(f.id)}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View
            style={{
              width: markerSize(f.reportCount),
              height: markerSize(f.reportCount),
              borderRadius: 999,
              backgroundColor: colors.accent,
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          />
        </Marker>
      ))}
    </RNMapView>
  );
}

function markerSize(count: number): number {
  return 14 + Math.min(18, count * 3);
}

function zoomToDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}
