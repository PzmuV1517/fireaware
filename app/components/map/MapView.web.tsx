import maplibregl, { type Map as MaplibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

import { BEARING_LINE_M, bearingBetween, offsetPoint } from "./types";
import type { FireMarker, MapViewProps, ReportMarker } from "./types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const LINES_SOURCE = "fa-report-lines";
const LINES_LAYER_MATCHED = "fa-report-lines-matched";
const LINES_LAYER_PENDING = "fa-report-lines-pending";
const DOTS_SOURCE = "fa-report-dots";
const DOTS_LAYER = "fa-report-dots";
const PIN_LINE_SOURCE = "fa-pin-line";
const PIN_LINE_LAYER = "fa-pin-line";

export function MapView({
  fires,
  reports,
  showReports,
  pin,
  redrawTick,
  initialCenter,
  initialZoom = 6,
  onSelectFire,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const fireMarkersRef = useRef<Map<string, Marker>>(new Map());
  const pinObserverRef = useRef<Marker | null>(null);
  const pinTargetRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelectFire);
  onSelectRef.current = onSelectFire;
  const onMapClickRef = useRef(pin?.onMapClick);
  onMapClickRef.current = pin?.onMapClick;
  // bumps each time the map (re)initialises its style/sources — every sync
  // effect depends on this so they re-apply current data after a tab focus or
  // a maplibre style reload.
  const [mapEpoch, setMapEpoch] = useState(0);

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
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      "top-right",
    );
    mapRef.current = map;

    const ensureLayers = () => {
      if (!map.getSource(LINES_SOURCE)) {
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
      }
      if (!map.getSource(DOTS_SOURCE)) {
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
      }
      if (!map.getSource(PIN_LINE_SOURCE)) {
        map.addSource(PIN_LINE_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: PIN_LINE_LAYER,
          type: "line",
          source: PIN_LINE_SOURCE,
          paint: { "line-color": colors.accent, "line-width": 2.5 },
        });
      }
      setMapEpoch((e) => e + 1);
    };

    map.on("load", ensureLayers);
    // fires whenever the style is (re)loaded — including after a tab-out
    // restore on some browsers, when the WebGL context comes back
    map.on("style.load", ensureLayers);

    map.on("click", (e) => {
      const handler = onMapClickRef.current;
      if (!handler) return;
      handler({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    const onVisibility = () => {
      if (document.hidden) return;
      // tab is visible again — make sure the canvas is sized right and bump
      // the epoch so the sync effects re-apply their data
      map.resize();
      setMapEpoch((e) => e + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
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
  }, [fires, mapEpoch, redrawTick]);

  // sync pin overlay (observer marker, bearing line, cursor tracking)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = pin ? "crosshair" : "";

    pinObserverRef.current = syncPin(
      map,
      pinObserverRef.current,
      pin?.observer ?? null,
      "observer",
    );
    // target dot removed — the bearing line itself shows where you're aiming
    pinTargetRef.current = syncPin(map, pinTargetRef.current, null, "target");

    const setLine = (start: { lat: number; lon: number }, brgDeg: number) => {
      const src = map.getSource(PIN_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const end = offsetPoint(start.lat, start.lon, brgDeg, BEARING_LINE_M);
      src.setData({
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [start.lon, start.lat],
                [end.lon, end.lat],
              ],
            },
          },
        ],
      });
    };

    const clearLine = () => {
      const src = map.getSource(PIN_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      src?.setData(emptyFC());
    };

    const applyLockedOrEmpty = () => {
      if (pin?.observer && pin?.target) {
        const brg = bearingBetween(pin.observer.lat, pin.observer.lon, pin.target.lat, pin.target.lon);
        setLine(pin.observer, brg);
      } else if (!pin?.observer) {
        clearLine();
      }
      // observer-only state intentionally left blank — cursor handler paints it
    };
    if (map.isStyleLoaded() && map.getSource(PIN_LINE_SOURCE)) applyLockedOrEmpty();
    else map.once("idle", applyLockedOrEmpty);

    // when observer is placed but target isn't yet, the bearing line follows
    // the cursor with the fixed standard length
    const observer = pin?.observer;
    const targetLocked = Boolean(pin?.target);
    if (!observer || targetLocked) return;

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const brg = bearingBetween(observer.lat, observer.lon, e.lngLat.lat, e.lngLat.lng);
      setLine(observer, brg);
    };
    const onLeave = () => clearLine();
    map.on("mousemove", onMove);
    map.getCanvas().addEventListener("mouseleave", onLeave);
    return () => {
      map.off("mousemove", onMove);
      map.getCanvas().removeEventListener("mouseleave", onLeave);
    };
  }, [pin, mapEpoch]);

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
    if (map.isStyleLoaded() && map.getSource(LINES_SOURCE)) apply();
    else map.once("idle", apply);
  }, [reports, showReports, mapEpoch, redrawTick]);

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

function syncPin(
  map: MaplibreMap,
  current: Marker | null,
  coord: { lat: number; lon: number } | null,
  kind: "observer" | "target",
): Marker | null {
  if (!coord) {
    current?.remove();
    return null;
  }
  if (!current) {
    const el = document.createElement("div");
    if (kind === "observer") {
      el.style.cssText = `width:18px;height:18px;border-radius:999px;background:${colors.accent};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);pointer-events:none;`;
    } else {
      el.style.cssText = `width:14px;height:14px;border-radius:999px;background:#fff;border:2px solid ${colors.accent};box-shadow:0 0 0 1px rgba(0,0,0,0.15);pointer-events:none;`;
    }
    return new maplibregl.Marker({ element: el }).setLngLat([coord.lon, coord.lat]).addTo(map);
  }
  current.setLngLat([coord.lon, coord.lat]);
  return current;
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
