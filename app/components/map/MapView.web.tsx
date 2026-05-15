import maplibregl, { type Map as MaplibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

import {
  BEARING_LINE_M,
  bearingBetween,
  haversineM,
  offsetPoint,
  polygonTop,
} from "./types";
import type {
  CuttingLineMarker,
  FireMarker,
  FireZoneMarker,
  MapViewProps,
  ReportMarker,
  WaterReserveMarker,
} from "./types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const LINES_SOURCE = "fa-report-lines";
const LINES_LAYER_MATCHED = "fa-report-lines-matched";
const LINES_LAYER_PENDING = "fa-report-lines-pending";
const DOTS_SOURCE = "fa-report-dots";
const DOTS_LAYER = "fa-report-dots";
const PIN_LINE_SOURCE = "fa-pin-line";
const PIN_LINE_LAYER = "fa-pin-line";
const ZONES_SOURCE = "fa-fire-zones";
const ZONES_FILL_LAYER = "fa-fire-zones-fill";
const ZONES_LINE_LAYER = "fa-fire-zones-line";
const ZONE_LABELS_SOURCE = "fa-fire-zone-labels";
const ZONE_LABELS_LAYER = "fa-fire-zone-labels";
const DRAWING_SOURCE = "fa-drawing";
const DRAWING_LINE_LAYER = "fa-drawing-line";
const DRAWING_DOTS_LAYER = "fa-drawing-dots";
const WATER_SOURCE = "fa-water-reserves";
const WATER_DOT_LAYER = "fa-water-reserves-dots";
const WATER_LINK_SOURCE = "fa-water-links";
const WATER_LINK_LAYER = "fa-water-links";
const CUTTING_SOURCE = "fa-cutting-lines";
const CUTTING_LAYER = "fa-cutting-lines";

export function MapView({
  fires,
  reports,
  showReports,
  pin,
  redrawTick,
  initialCenter,
  initialZoom = 6,
  onSelectFire,
  fireZones,
  drawingPoints,
  onMapClick,
  waterReserves,
  showClosestWater,
  styleUrl,
  hidePois,
  cuttingLines,
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
  const generalClickRef = useRef(onMapClick);
  generalClickRef.current = onMapClick;
  // bumps each time the map (re)initialises its style/sources — every sync
  // effect depends on this so they re-apply current data after a tab focus or
  // a maplibre style reload.
  const [mapEpoch, setMapEpoch] = useState(0);
  const prevStyleUrlRef = useRef(styleUrl ?? STYLE_URL);

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = initialCenter
      ? [initialCenter.lon, initialCenter.lat]
      : [-9.1393, 38.7223];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl ?? STYLE_URL,
      center,
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      "bottom-left",
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
      // fire zones fill + line
      if (!map.getSource(ZONES_SOURCE)) {
        map.addSource(ZONES_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: ZONES_FILL_LAYER, type: "fill", source: ZONES_SOURCE,
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: ZONES_LINE_LAYER, type: "line", source: ZONES_SOURCE,
          paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.9 },
        });
      }
      // zone labels — separate Point source so we control anchor + offset
      if (!map.getSource(ZONE_LABELS_SOURCE)) {
        map.addSource(ZONE_LABELS_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: ZONE_LABELS_LAYER,
          type: "symbol",
          source: ZONE_LABELS_SOURCE,
          layout: {
            "text-field": ["get", "label"],
            "text-size": 13,
            "text-anchor": "bottom",
            "text-offset": [0, -0.4],
            "text-allow-overlap": false,
            "text-font": ["Noto Sans Bold"],
          },
          paint: {
            "text-color": ["get", "color"],
            "text-halo-color": "#FFFFFF",
            "text-halo-width": 2,
          },
        });
      }
      // water reserves + fire→reserve link lines
      if (!map.getSource(WATER_LINK_SOURCE)) {
        map.addSource(WATER_LINK_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: WATER_LINK_LAYER,
          type: "line",
          source: WATER_LINK_SOURCE,
          paint: {
            "line-color": "#2A7FC9",
            "line-width": 2,
            "line-dasharray": [3, 2],
            "line-opacity": 0.85,
          },
        });
      }
      if (!map.getSource(WATER_SOURCE)) {
        map.addSource(WATER_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: WATER_DOT_LAYER,
          type: "circle",
          source: WATER_SOURCE,
          paint: {
            "circle-radius": 6,
            "circle-color": "#2A7FC9",
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 2,
          },
        });
      }
      // vegetation cutting lines
      if (!map.getSource(CUTTING_SOURCE)) {
        map.addSource(CUTTING_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: CUTTING_LAYER, type: "line", source: CUTTING_SOURCE,
          paint: { "line-color": "#E8A317", "line-width": 3, "line-dasharray": [6, 3] },
        });
      }
      // drawing preview
      if (!map.getSource(DRAWING_SOURCE)) {
        map.addSource(DRAWING_SOURCE, { type: "geojson", data: emptyFC() });
        map.addLayer({
          id: DRAWING_LINE_LAYER, type: "line", source: DRAWING_SOURCE,
          filter: ["==", "$type", "LineString"],
          paint: { "line-color": "#C9532A", "line-width": 2, "line-dasharray": [3, 2] },
        });
        map.addLayer({
          id: DRAWING_DOTS_LAYER, type: "circle", source: DRAWING_SOURCE,
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 5, "circle-color": "#C9532A", "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
        });
      }
      setMapEpoch((e) => e + 1);
    };

    map.on("load", ensureLayers);
    // fires whenever the style is (re)loaded — including after a tab-out
    // restore on some browsers, when the WebGL context comes back
    map.on("style.load", ensureLayers);

    map.on("click", (e) => {
      const coord = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      const pinHandler = onMapClickRef.current;
      if (pinHandler) pinHandler(coord);
      generalClickRef.current?.(coord);
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

  // sync fire zones (polygons + labels)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(ZONES_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(fireZonesToFC(fireZones ?? []));
      const labels = map.getSource(ZONE_LABELS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (labels) labels.setData(fireZoneLabelsToFC(fireZones ?? []));
    };
    if (map.isStyleLoaded() && map.getSource(ZONES_SOURCE)) apply();
    else map.once("idle", apply);
  }, [fireZones, mapEpoch, redrawTick]);

  // sync drawing preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(DRAWING_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(drawingToFC(drawingPoints ?? []));
    };
    if (map.isStyleLoaded() && map.getSource(DRAWING_SOURCE)) apply();
    else map.once("idle", apply);
  }, [drawingPoints, mapEpoch]);

  // sync water reserves + fire→closest reserve links
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const water = map.getSource(WATER_SOURCE) as maplibregl.GeoJSONSource | undefined;
      const links = map.getSource(WATER_LINK_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (water) water.setData(waterReservesToFC(waterReserves ?? []));
      if (links)
        links.setData(
          showClosestWater
            ? closestLinksFC(fires, waterReserves ?? [])
            : emptyFC(),
        );
    };
    if (map.isStyleLoaded() && map.getSource(WATER_SOURCE)) apply();
    else map.once("idle", apply);
  }, [waterReserves, fires, showClosestWater, mapEpoch, redrawTick]);

  // sync cutting lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(CUTTING_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(cuttingLinesToFC(cuttingLines ?? []));
    };
    if (map.isStyleLoaded() && map.getSource(CUTTING_SOURCE)) apply();
    else map.once("idle", apply);
  }, [cuttingLines, mapEpoch]);

  // switch base tile style when styleUrl prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = styleUrl ?? STYLE_URL;
    if (next === prevStyleUrlRef.current) return;
    prevStyleUrlRef.current = next;
    map.setStyle(next);
  }, [styleUrl]);

  // hide/show POI layers after every style load or when hidePois toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const layer of map.getStyle().layers ?? []) {
      if ((layer as { "source-layer"?: string })["source-layer"] === "poi") {
        map.setLayoutProperty(layer.id, "visibility", hidePois ? "none" : "visible");
      }
    }
  }, [hidePois, mapEpoch]);

  // cursor: crosshair when onMapClick is provided (pin cursor takes priority)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (!pin) canvas.style.cursor = onMapClick ? "crosshair" : "";
  }, [onMapClick, pin, mapEpoch]);

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

function cuttingLinesToFC(lines: CuttingLineMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: lines.map((l) => ({
      type: "Feature" as const,
      properties: { id: l.id, label: l.label ?? "" },
      geometry: { type: "LineString" as const, coordinates: l.coordinates },
    })),
  };
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

function fireZonesToFC(zones: FireZoneMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: zones.map((z) => ({
      type: "Feature" as const,
      properties: { id: z.id, color: z.color, label: z.label ?? "" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[...z.coordinates, z.coordinates[0]]],
      },
    })),
  };
}

function drawingToFC(pts: [number, number][]) {
  type Feat = { type: "Feature"; properties: Record<string, never>; geometry: { type: "LineString"; coordinates: [number, number][] } | { type: "Point"; coordinates: [number, number] } };
  const features: Feat[] = [];
  if (pts.length >= 2) {
    features.push({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: pts },
    });
  }
  pts.forEach((pt) => {
    features.push({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: pt },
    });
  });
  return { type: "FeatureCollection" as const, features };
}

function fireZoneLabelsToFC(zones: FireZoneMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: zones
      .filter((z) => z.label && z.label.trim())
      .map((z) => {
        const top = polygonTop(z.coordinates);
        return {
          type: "Feature" as const,
          properties: { id: z.id, label: z.label ?? "", color: z.color },
          geometry: { type: "Point" as const, coordinates: [top.lon, top.lat] },
        };
      }),
  };
}

function waterReservesToFC(reserves: WaterReserveMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: reserves.map((r) => ({
      type: "Feature" as const,
      properties: { id: r.id, name: r.name },
      geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
    })),
  };
}

function closestLinksFC(fires: FireMarker[], reserves: WaterReserveMarker[]) {
  if (reserves.length === 0) return emptyFC();
  return {
    type: "FeatureCollection" as const,
    features: fires
      .map((f) => {
        let best: WaterReserveMarker | null = null;
        let bestD = Infinity;
        for (const r of reserves) {
          const d = haversineM(f.lat, f.lon, r.lat, r.lon);
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        if (!best) return null;
        return {
          type: "Feature" as const,
          properties: { fireId: f.id, reserveId: best.id, distance_m: bestD },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [f.lon, f.lat],
              [best.lon, best.lat],
            ],
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}
