import maplibregl, { type Map as MaplibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

import { BEARING_LINE_M, offsetPoint } from "./types";
import type { FireMarker, MapViewProps, ReportMarker } from "./types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const LINES_SOURCE = "fa-report-lines";
const LINES_LAYER_MATCHED = "fa-report-lines-matched";
const LINES_LAYER_PENDING = "fa-report-lines-pending";
const DOTS_SOURCE = "fa-report-dots";
const DOTS_LAYER = "fa-report-dots";

export function MapView({
  fires,
  reports,
  showReports,
  initialCenter,
  initialZoom = 6,
  onSelectFire,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const fireMarkersRef = useRef<Map<string, Marker>>(new Map());
  const onSelectRef = useRef(onSelectFire);
  onSelectRef.current = onSelectFire;

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = initialCenter
      ? [initialCenter.lon, initialCenter.lat]
      : [-9.1393, 38.7223];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(LINES_SOURCE, { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: LINES_LAYER_PENDING,
        type: "line",
        source: LINES_SOURCE,
        filter: ["==", ["get", "matched"], false],
        paint: {
          "line-color": colors.inkMuted,
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.7,
        },
      });
      map.addLayer({
        id: LINES_LAYER_MATCHED,
        type: "line",
        source: LINES_SOURCE,
        filter: ["==", ["get", "matched"], true],
        paint: { "line-color": colors.accent, "line-width": 2, "line-opacity": 0.85 },
      });
      map.addSource(DOTS_SOURCE, { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: DOTS_LAYER,
        type: "circle",
        source: DOTS_SOURCE,
        paint: {
          "circle-radius": 4,
          "circle-color": [
            "case",
            ["==", ["get", "matched"], true],
            colors.accent,
            "#FFFFFF",
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "matched"], true],
            "#FFFFFF",
            colors.inkMuted,
          ],
          "circle-stroke-width": 1.5,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync fires (DOM markers, so they remain clickable + stay on top)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    fires.forEach((f) => syncFire(f, map, fireMarkersRef.current, onSelectRef, seen));
    for (const [id, marker] of fireMarkersRef.current.entries()) {
      if (!seen.has(id)) {
        marker.remove();
        fireMarkersRef.current.delete(id);
      }
    }
  }, [fires]);

  // sync reports + bearing lines via GeoJSON sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visible = showReports ? reports ?? [] : [];
    const apply = () => {
      const lines = map.getSource(LINES_SOURCE) as maplibregl.GeoJSONSource | undefined;
      const dots = map.getSource(DOTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (lines) lines.setData(reportsToLineFC(visible));
      if (dots) dots.setData(reportsToDotFC(visible));
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [reports, showReports]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </View>
  );
}

function syncFire(
  fire: FireMarker,
  map: MaplibreMap,
  cache: Map<string, Marker>,
  onSelectRef: { current: ((id: string) => void) | undefined },
  seen: Set<string>,
) {
  seen.add(fire.id);
  let marker = cache.get(fire.id);
  if (!marker) {
    const el = document.createElement("button");
    el.style.cssText = `
      width: ${fireSize(fire)}px;
      height: ${fireSize(fire)}px;
      border-radius: 999px;
      background: ${colors.accent};
      border: 2px solid #fff;
      box-shadow: 0 0 0 4px ${colors.accent}22;
      cursor: pointer;
      padding: 0;
    `;
    el.setAttribute("aria-label", "Fire report");
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelectRef.current?.(fire.id);
    });
    marker = new maplibregl.Marker({ element: el }).setLngLat([fire.lon, fire.lat]).addTo(map);
    cache.set(fire.id, marker);
  } else {
    marker.setLngLat([fire.lon, fire.lat]);
    const el = marker.getElement() as HTMLElement;
    el.style.width = `${fireSize(fire)}px`;
    el.style.height = `${fireSize(fire)}px`;
  }
}

function fireSize(f: FireMarker): number {
  return 14 + Math.min(18, f.reportCount * 3);
}

function emptyFC() {
  return { type: "FeatureCollection" as const, features: [] };
}

function reportsToLineFC(reports: ReportMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((r) => {
      const end = offsetPoint(r.lat, r.lon, r.bearingDeg, BEARING_LINE_M);
      return {
        type: "Feature" as const,
        properties: { id: r.id, matched: r.matched },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [r.lon, r.lat],
            [end.lon, end.lat],
          ],
        },
      };
    }),
  };
}

function reportsToDotFC(reports: ReportMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((r) => ({
      type: "Feature" as const,
      properties: { id: r.id, matched: r.matched },
      geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
    })),
  };
}
