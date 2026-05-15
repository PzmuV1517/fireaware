import RNMapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

import type { LatLon, PinPickerProps } from "./PinPickerTypes";

export function PinPicker({ start, observer, target, onTap }: PinPickerProps) {
  const t = useTheme();
  return (
    <RNMapView
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude: start.lat,
        longitude: start.lon,
        latitudeDelta: start.delta,
        longitudeDelta: start.delta,
      }}
      onPress={(e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onTap({ lat: latitude, lon: longitude });
      }}
    >
      {observer && <ObserverPin coord={observer} color={t.colors.accent} />}
      {target && <TargetPin coord={target} color={t.colors.accent} />}
      {observer && target && (
        <Polyline
          coordinates={[
            { latitude: observer.lat, longitude: observer.lon },
            { latitude: target.lat, longitude: target.lon },
          ]}
          strokeColor={t.colors.accent}
          strokeWidth={2.5}
        />
      )}
    </RNMapView>
  );
}

function ObserverPin({ coord, color }: { coord: LatLon; color: string }) {
  return (
    <Marker
      identifier="observer"
      coordinate={{ latitude: coord.lat, longitude: coord.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: "#FFFFFF",
        }}
      />
    </Marker>
  );
}

function TargetPin({ coord, color }: { coord: LatLon; color: string }) {
  return (
    <Marker
      identifier="target"
      coordinate={{ latitude: coord.lat, longitude: coord.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          borderWidth: 2,
          borderColor: color,
        }}
      />
    </Marker>
  );
}
