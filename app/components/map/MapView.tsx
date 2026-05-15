import RNMapView, { Marker, Polygon, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet, Text as RNText, View } from "react-native";

import { colors } from "@/theme/tokens";

import { BEARING_LINE_M, bearingBetween, haversineM, offsetPoint, polygonTop } from "./types";
import type { FireMarker, MapViewProps, WaterReserveMarker } from "./types";

export function MapView({
  fires,
  reports,
  showReports,
  pin,
  initialCenter,
  initialZoom = 6,
  onSelectFire,
  fireZones,
  waterReserves,
  showClosestWater,
  cuttingLines,
}: MapViewProps) {
  const center = initialCenter ?? { lat: 38.7223, lon: -9.1393 };
  const delta = zoomToDelta(initialZoom);

  return (
    <RNMapView
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      showsUserLocation
      showsMyLocationButton={false}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lon,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
      onPress={(e) => {
        if (!pin) return;
        const { latitude, longitude } = e.nativeEvent.coordinate;
        pin.onMapClick({ lat: latitude, lon: longitude });
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
        (reports ?? []).flatMap((r) => {
          // draw the dot as a 1-metre line with round caps — this guarantees
          // it lands exactly on the coordinate where the bearing line starts,
          // unlike react-native-maps Markers with custom child views which
          // anchor inconsistently on Android.
          const tip = offsetPoint(r.lat, r.lon, r.bearingDeg, 0.1);
          return [
            <Polyline
              key={`rep-bg-${r.id}`}
              coordinates={[
                { latitude: r.lat, longitude: r.lon },
                { latitude: tip.lat, longitude: tip.lon },
              ]}
              strokeColor={r.matched ? "#FFFFFF" : colors.inkMuted}
              strokeWidth={14}
              lineCap="round"
              zIndex={5}
            />,
            <Polyline
              key={`rep-fg-${r.id}`}
              coordinates={[
                { latitude: r.lat, longitude: r.lon },
                { latitude: tip.lat, longitude: tip.lon },
              ]}
              strokeColor={r.matched ? colors.accent : "#FFFFFF"}
              strokeWidth={10}
              lineCap="round"
              zIndex={6}
            />,
          ];
        })}

      {pin?.observer && pin?.target && (() => {
        const brg = bearingBetween(
          pin.observer.lat,
          pin.observer.lon,
          pin.target.lat,
          pin.target.lon,
        );
        const end = offsetPoint(pin.observer.lat, pin.observer.lon, brg, BEARING_LINE_M);
        return (
          <Polyline
            key="pin-line"
            coordinates={[
              { latitude: pin.observer.lat, longitude: pin.observer.lon },
              { latitude: end.lat, longitude: end.lon },
            ]}
            strokeColor={colors.accent}
            strokeWidth={2.5}
          />
        );
      })()}
      {pin?.observer &&
        (() => {
          // observer dot as a 1m fat polyline so it lands exactly on the pinned
          // coordinate, regardless of marker-anchor quirks on Android
          const tip = offsetPoint(pin.observer.lat, pin.observer.lon, 0, 0.1);
          return (
            <>
              <Polyline
                key="pin-obs-bg"
                coordinates={[
                  { latitude: pin.observer.lat, longitude: pin.observer.lon },
                  { latitude: tip.lat, longitude: tip.lon },
                ]}
                strokeColor="#FFFFFF"
                strokeWidth={22}
                lineCap="round"
                zIndex={20}
              />
              <Polyline
                key="pin-obs-fg"
                coordinates={[
                  { latitude: pin.observer.lat, longitude: pin.observer.lon },
                  { latitude: tip.lat, longitude: tip.lon },
                ]}
                strokeColor={colors.accent}
                strokeWidth={16}
                lineCap="round"
                zIndex={21}
              />
            </>
          );
        })()}

      {(cuttingLines ?? []).map((l) => (
        <Polyline
          key={`cut-${l.id}`}
          coordinates={l.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))}
          strokeColor="#E8A317"
          strokeWidth={3}
          lineDashPattern={[8, 4]}
          zIndex={3}
        />
      ))}

      {(fireZones ?? []).map((z) => (
        <Polygon
          key={z.id}
          coordinates={z.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))}
          fillColor={z.color + "30"}
          strokeColor={z.color}
          strokeWidth={2}
        />
      ))}

      {(fireZones ?? [])
        .filter((z) => z.label && z.label.trim())
        .map((z) => {
          const top = polygonTop(z.coordinates);
          return (
            <Marker
              key={`zone-label-${z.id}`}
              coordinate={{ latitude: top.lat, longitude: top.lon }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={15}
            >
              <View
                style={{
                  backgroundColor: "#FFFFFFEE",
                  borderColor: z.color,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  marginBottom: 4,
                }}
              >
                <RNText
                  style={{ color: z.color, fontSize: 12, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {z.label}
                </RNText>
              </View>
            </Marker>
          );
        })}

      {showClosestWater &&
        fires.map((f) => {
          const nearest = closestReserve(f, waterReserves ?? []);
          if (!nearest) return null;
          return (
            <Polyline
              key={`fire-water-${f.id}`}
              coordinates={[
                { latitude: f.lat, longitude: f.lon },
                { latitude: nearest.lat, longitude: nearest.lon },
              ]}
              strokeColor="#2A7FC9"
              strokeWidth={2}
              lineDashPattern={[6, 4]}
              zIndex={4}
            />
          );
        })}

      {(waterReserves ?? []).map((r) => (
        <Marker
          key={`water-${r.id}`}
          coordinate={{ latitude: r.lat, longitude: r.lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          zIndex={8}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: "#2A7FC9",
              borderWidth: 2,
              borderColor: "#FFFFFF",
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

function closestReserve(
  fire: FireMarker,
  reserves: WaterReserveMarker[],
): WaterReserveMarker | null {
  let best: WaterReserveMarker | null = null;
  let bestD = Infinity;
  for (const r of reserves) {
    const d = haversineM(fire.lat, fire.lon, r.lat, r.lon);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
