import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

import { MapView } from "@/components/map/MapView";
import type {
  CuttingLineMarker,
  FireZoneMarker,
  MapViewProps,
  PinOverlay,
  WaterReserveMarker,
} from "@/components/map/types";
import { api, type Fire as FireDto, type WaterReserve as WaterReserveDto } from "@/lib/api";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useTheme } from "@/theme";

/**
 * Per-screen overrides that a child route writes into the shared map. Anything
 * left undefined falls back to the shell's default.
 */
export interface MapShellConfig {
  showReports?: boolean;
  showClosestWater?: boolean;
  pin?: PinOverlay;
  drawingPoints?: [number, number][];
  onMapClick?: (coord: { lat: number; lon: number }) => void;
  onSelectFire?: (id: string) => void;
  styleUrl?: string;
  hidePois?: boolean;
}

interface MapShellApi {
  /** Replace the current screen's config. Pass {} to clear back to defaults. */
  setConfig: (next: MapShellConfig) => void;
  /** Force the underlying MapView's sync effects to re-apply their data. */
  bumpRedraw: () => void;
  /** Refetch the shared map queries. */
  refetch: () => Promise<void>;
  /** Live data — children can read these to drive their own UI (e.g. a fire list). */
  fires: FireDto[];
  waterReserves: WaterReserveDto[];
  /** Resolve (soft-delete) a fire as a fireman. Refetches on success. */
  resolveFire: (id: string) => Promise<void>;
}

const Ctx = createContext<MapShellApi | null>(null);

export function useMapShell(): MapShellApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMapShell must be used inside <MapShell>");
  return ctx;
}

/**
 * Renders the single, persistent MapView shared by /map and /mission-control.
 * Lives in the (map) route-group layout so navigating between sibling routes
 * never unmounts the map.
 */
export function MapShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const qc = useQueryClient();
  const mapCenter = useInitialMapCenter();
  const [config, setConfigState] = useState<MapShellConfig>({});
  const [redrawTick, setRedrawTick] = useState(0);

  const { data: fires } = useQuery({
    queryKey: ["fires", "all"],
    queryFn: () => api.fires.list(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => api.reports.list({ sinceMin: 240 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    placeholderData: keepPreviousData,
    // always fetch — the visibility toggle is `showReports` on MapView, not
    // the query itself. Keeping it enabled means switching screens doesn't
    // refetch from scratch.
  });

  const { data: fireZones } = useQuery({
    queryKey: ["fire-zones"],
    queryFn: () => api.fireZones.list(),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: waterReserves } = useQuery({
    queryKey: ["water-reserves"],
    queryFn: () => api.waterReserves.list(),
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  });

  const { data: cuttingLines } = useQuery({
    queryKey: ["cutting-lines"],
    queryFn: () => api.cuttingLines.list(),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const configRef = useRef(config);
  configRef.current = config;

  const setConfig = useCallback((next: MapShellConfig) => {
    // skip the state update if nothing actually changed — avoids re-render
    // storms when a child screen's effect re-runs with the same object shape
    const prev = configRef.current;
    if (
      prev.showReports === next.showReports &&
      prev.showClosestWater === next.showClosestWater &&
      prev.pin === next.pin &&
      prev.drawingPoints === next.drawingPoints &&
      prev.onMapClick === next.onMapClick &&
      prev.onSelectFire === next.onSelectFire &&
      prev.styleUrl === next.styleUrl &&
      prev.hidePois === next.hidePois
    ) {
      return;
    }
    setConfigState(next);
  }, []);

  const bumpRedraw = useCallback(() => {
    setRedrawTick((n) => n + 1);
  }, []);

  const refetch = useCallback(async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["fires"] }),
      qc.refetchQueries({ queryKey: ["reports", "public"] }),
      qc.refetchQueries({ queryKey: ["fire-zones"] }),
      qc.refetchQueries({ queryKey: ["water-reserves"] }),
      qc.refetchQueries({ queryKey: ["cutting-lines"] }),
    ]);
  }, [qc]);

  const resolveFire = useCallback(
    async (id: string) => {
      await api.fires.resolve(id);
      await qc.refetchQueries({ queryKey: ["fires"] });
    },
    [qc],
  );

  const api_ = useMemo<MapShellApi>(
    () => ({
      setConfig,
      bumpRedraw,
      refetch,
      fires: fires ?? [],
      waterReserves: waterReserves ?? [],
      resolveFire,
    }),
    [setConfig, bumpRedraw, refetch, fires, waterReserves, resolveFire],
  );

  const fireMarkers = useMemo<MapViewProps["fires"]>(
    () =>
      (fires ?? []).map((f) => ({
        id: f.id,
        lat: f.lat,
        lon: f.lon,
        confidence: f.confidence,
        reportCount: f.report_count,
      })),
    [fires],
  );

  const reportMarkers = useMemo<NonNullable<MapViewProps["reports"]>>(
    () =>
      (reports ?? []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lon: r.lon,
        bearingDeg: r.bearing_deg,
        matched: r.fire_id != null,
      })),
    [reports],
  );

  const zoneMarkers = useMemo<FireZoneMarker[]>(
    () =>
      (fireZones ?? []).map((z) => ({
        id: z.id,
        coordinates: z.coordinates as [number, number][],
        label: z.label,
        color: z.color,
      })),
    [fireZones],
  );

  const waterReserveMarkers = useMemo<WaterReserveMarker[]>(
    () =>
      (waterReserves ?? []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lon: r.lon,
        name: r.name,
      })),
    [waterReserves],
  );

  const cuttingLineMarkers = useMemo<CuttingLineMarker[]>(
    () =>
      (cuttingLines ?? []).map((l) => ({
        id: l.id,
        coordinates: l.coordinates,
        label: l.label,
      })),
    [cuttingLines],
  );

  return (
    <Ctx.Provider value={api_}>
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        {mapCenter && (
          <MapView
            fires={fireMarkers}
            reports={reportMarkers}
            fireZones={zoneMarkers}
            waterReserves={waterReserveMarkers}
            showReports={config.showReports ?? false}
            showClosestWater={config.showClosestWater ?? false}
            pin={config.pin}
            drawingPoints={config.drawingPoints}
            onMapClick={config.onMapClick}
            onSelectFire={config.onSelectFire}
            cuttingLines={cuttingLineMarkers}
            styleUrl={config.styleUrl}
            hidePois={config.hidePois}
            redrawTick={redrawTick}
            initialCenter={mapCenter.center}
            initialZoom={mapCenter.zoom}
          />
        )}
        {children}
      </View>
    </Ctx.Provider>
  );
}
