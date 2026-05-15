import RNMapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet } from "react-native";

import { useTheme } from "@/theme";

import { BEARING_LINE_M, bearingBetween, offsetPoint } from "./types";
import type { PinPickerProps } from "./PinPickerTypes";

export function PinPicker({ start, observer, aim, onTap, onPan }: PinPickerProps) {
  const t = useTheme();

  // when the observer is placed, disable map scrolling so finger drags can be
  // captured as aim-rotation instead of map-panning
  const aimMode = observer != null;

  const lineEnd =
    observer && aim
      ? offsetPoint(
          observer.lat,
          observer.lon,
          bearingBetween(observer.lat, observer.lon, aim.lat, aim.lon),
          BEARING_LINE_M,
        )
      : null;

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
      scrollEnabled={!aimMode}
      pitchEnabled={!aimMode}
      rotateEnabled={!aimMode}
      onPress={(e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onTap({ lat: latitude, lon: longitude });
      }}
      onPanDrag={(e) => {
        if (!aimMode) return;
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onPan({ lat: latitude, lon: longitude });
      }}
    >
      {observer && lineEnd && (
        <Polyline
          coordinates={[
            { latitude: observer.lat, longitude: observer.lon },
            { latitude: lineEnd.lat, longitude: lineEnd.lon },
          ]}
          strokeColor={t.colors.accent}
          strokeWidth={2.5}
        />
      )}
      {observer &&
        (() => {
          const tip = offsetPoint(observer.lat, observer.lon, 0, 0.1);
          return (
            <>
              <Polyline
                coordinates={[
                  { latitude: observer.lat, longitude: observer.lon },
                  { latitude: tip.lat, longitude: tip.lon },
                ]}
                strokeColor="#FFFFFF"
                strokeWidth={22}
                lineCap="round"
                zIndex={20}
              />
              <Polyline
                coordinates={[
                  { latitude: observer.lat, longitude: observer.lon },
                  { latitude: tip.lat, longitude: tip.lon },
                ]}
                strokeColor={t.colors.accent}
                strokeWidth={16}
                lineCap="round"
                zIndex={21}
              />
            </>
          );
        })()}
    </RNMapView>
  );
}
